from typing import Literal, Optional
from itgs import Itgs
from redis_helpers.touch_to_log_scanner import touch_to_log_scanner
from redis_helpers.touch_to_send_scanner import touch_to_send_scanner


REDIS_SCAN_BATCH_SIZE = 20
"""The maximum number of items that we have redis scan through at a time
before yielding to allow other requests to be processed.
"""


async def find_user_for_touch(itgs: Itgs, /, *, touch_uid: str) -> Optional[str]:
    """Finds the sub of the user the given touch is associated with, if it
    can be found. This assumes that the touch uid came from a reliable source
    and hence we are very, very likely to find the touch. This can be quite
    slow (multiple seconds) if the touch doesn't actually exist.

    This uses consecutively more expensive queries to search for the user
    regardless of the state of the touch. This is guarranteed to find the user
    associated with the touch so long as the touch is stored somewhere and the
    jobs all meet their guarantees about the order that the touch is moved.

    Args:
        itgs (Itgs): the integrations to (re)use
        touch_uid (str): the send uid of the touch to search for

    Returns:
        (str, None): the sub of the user associated with the touch, if it could
            be found. None if no touch with that uid could be found
    """
    user_sub = await _find_user_for_touch_in_db(
        itgs, touch_uid=touch_uid, consistency="none"
    )
    if user_sub is not None:
        return user_sub
    user_sub = await _find_user_for_touch_in_db(
        itgs, touch_uid=touch_uid, consistency="weak"
    )
    if user_sub is not None:
        return user_sub
    user_sub = await _find_user_for_touch_in_redis_to_send(itgs, touch_uid=touch_uid)
    if user_sub is not None:
        return user_sub
    user_sub = await _find_user_for_touch_in_redis_to_log(itgs, touch_uid=touch_uid)
    if user_sub is not None:
        return user_sub
    user_sub = await _find_user_for_touch_in_redis_purgatory(itgs, touch_uid=touch_uid)
    if user_sub is not None:
        return user_sub
    return await _find_user_for_touch_in_db(
        itgs, touch_uid=touch_uid, consistency="strong"
    )


async def _find_user_for_touch_in_db(
    itgs: Itgs, /, *, touch_uid: str, consistency: Literal["none", "weak", "strong"]
):
    """Scans the database for the user associated with the given touch at
    the given consistency level.

    Args:
        itgs (Itgs): the integrations to (re)use
        touch_uid (str): the send uid of the touch to search for
        consistency (Literal['none', 'weak', 'strong']): the consistency level
            to use
    """
    conn = await itgs.conn()
    cursor = conn.cursor(consistency)

    response = await cursor.execute(
        "SELECT users.sub FROM user_touches, users "
        "WHERE users.id = user_touches.user_id AND user_touches.send_uid = ? "
        "ORDER BY user_touches.id ASC LIMIT 1",
        (touch_uid,),
    )
    if response.results:
        return response.results[0][0]
    return None


async def _find_user_for_touch_in_redis_to_send(
    itgs: Itgs, /, *, touch_uid: str
) -> Optional[str]:
    """Scans the redis touch:to_send queue in batches, searching for the user
    associated with the touch with the given send uid. This searches
    right to left, i.e., most recently added to least recently added.

    This is only guarranteed to find an item which is in the to_send queue
    for the entire duration of the scan; items which are added after the
    scan starts or removed during the scan may be missed.

    In theory this would never find links the user has actually received.

    Args:
        itgs (Itgs): the integrations to (re)use
        touch_uid (str): the send uid of the touch to search for

    Returns:
        (str, None): the user sub, if the touch was found. None otherwise
    """
    redis = await itgs.redis()
    next_index = -1
    while True:
        res = await touch_to_send_scanner(
            redis, touch_uid, next_index, REDIS_SCAN_BATCH_SIZE
        )
        assert res is not None
        found, next_index, user_sub = res
        if found:
            return user_sub
        if next_index == 0:
            return None


async def _find_user_for_touch_in_redis_to_log(
    itgs: Itgs, /, *, touch_uid: str
) -> Optional[str]:
    """Scans the redis touch:to_log queue in batches, searching for the user
    associated with the touch with the given send uid. This searches
    right to left, i.e., most recently added to least recently added.

    This is only guarranteed to find an item which is in the to_log queue
    for the entire duration of the scan; items which are added after the
    scan starts or removed during the scan may be missed.

    This will find links that the user has received very recently, for which
    we haven't yet persisted to the database in order to facilitate batching.

    Args:
        itgs (Itgs): the integrations to (re)use
        touch_uid (str): the send uid of the touch to search for

    Returns:
        (str, None): the user sub, if the touch was found. None otherwise
    """
    redis = await itgs.redis()
    next_index = -1
    while True:
        res = await touch_to_log_scanner(
            redis, "touch:to_log", touch_uid, next_index, REDIS_SCAN_BATCH_SIZE
        )
        assert res is not None
        found, next_index, user_sub = res
        if found:
            return user_sub
        if next_index == 0:
            return None


async def _find_user_for_touch_in_redis_purgatory(
    itgs: Itgs, /, *, touch_uid: str
) -> Optional[str]:
    """Scans the redis touch:log_purgatory queue in batches, searching for the user
    associated with the touch with the given send uid. This searches
    right to left, i.e., most recently added to least recently added.

    This is only guarranteed to find an item which is in the to_log queue
    for the entire duration of the scan; items which are added after the
    scan starts or removed during the scan may be missed.

    This will find links that the user has received very recently, for which we
    haven't yet persisted to the database in order to facilitate batching, and
    for which we are actively in the process of persisting. Typically this will
    only find links in either extremely rare cases where there is truly a race
    here, or when the touch log persist job is failing.

    Args:
        itgs (Itgs): the integrations to (re)use
        touch_uid (str): the send uid of the touch to search for

    Returns:
        (str, None): the user sub, if the touch was found. None otherwise
    """
    redis = await itgs.redis()
    next_index = -1
    while True:
        res = await touch_to_log_scanner(
            redis, "touch:log_purgatory", touch_uid, next_index, REDIS_SCAN_BATCH_SIZE
        )
        assert res is not None
        found, next_index, user_sub = res
        if found:
            return user_sub
        if next_index == 0:
            return None
