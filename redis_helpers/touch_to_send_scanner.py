from typing import Optional, List, Tuple, Union
import hashlib
import time
import redis.asyncio.client

TOUCH_TO_SEND_SCANNER_LUA_SCRIPT = """
local target_touch_uid = ARGV[1]
local start_index = tonumber(ARGV[2])
local max_count = tonumber(ARGV[3])

local list_length = redis.call("LLEN", "touch:to_send")
if list_length == 0 then return {0, 0, false} end

if start_index < 0 then
    start_index = list_length + start_index + 1
    if start_index < 1 then
        return {0, 0, false}
    end
end

local index = start_index
local remaining = max_count

if index > list_length then
    local num_to_skip = index - list_length
    index = list_length
    remaining = remaining - num_to_skip
end

while remaining > 0 and index > 0 do
    local raw = redis.call("LINDEX", "touch:to_send", index)
    if raw ~= false then
        local decoded = cjson.decode(raw)
        if decoded.uid == target_touch_uid then
            return {1, index, decoded.user_sub}
        end
    end
    index = index - 1
    remaining = remaining - 1
end

return {0, index, false}
"""

TOUCH_TO_SEND_SCANNER_LUA_SCRIPT_HASH = hashlib.sha1(
    TOUCH_TO_SEND_SCANNER_LUA_SCRIPT.encode("utf-8")
).hexdigest()


_last_touch_to_send_scanner_ensured_at: Optional[float] = None


async def ensure_touch_to_send_scanner_script_exists(
    redis: redis.asyncio.client.Redis, *, force: bool = False
) -> None:
    """Ensures the touch_to_send_scanner lua script is loaded into redis."""
    global _last_touch_to_send_scanner_ensured_at

    now = time.time()
    if (
        not force
        and _last_touch_to_send_scanner_ensured_at is not None
        and (now - _last_touch_to_send_scanner_ensured_at < 5)
    ):
        return

    loaded: List[bool] = await redis.script_exists(
        TOUCH_TO_SEND_SCANNER_LUA_SCRIPT_HASH
    )
    if not loaded[0]:
        correct_hash = await redis.script_load(TOUCH_TO_SEND_SCANNER_LUA_SCRIPT)
        assert (
            correct_hash == TOUCH_TO_SEND_SCANNER_LUA_SCRIPT_HASH
        ), f"{correct_hash=} != {TOUCH_TO_SEND_SCANNER_LUA_SCRIPT_HASH=}"

    if (
        _last_touch_to_send_scanner_ensured_at is None
        or _last_touch_to_send_scanner_ensured_at < now
    ):
        _last_touch_to_send_scanner_ensured_at = now


async def touch_to_send_scanner(
    redis: redis.asyncio.client.Redis,
    target_touch_uid: str,
    start_index: int,
    max_count: int,
) -> Optional[Tuple[bool, int, Optional[str]]]:
    """Scans through the touch:to_send list in redis to find the user associated
    with the touch with the given send uid. This works in reverse order.

    Typically, this would be called as if by the following pseudocode:

    ```py
    next_index = -1
    while True:
        found, next_index, user_sub = await touch_to_send_scanner(
            redis, target_touch_uid, next_index, 20
        )
        if found:
            return user_sub
        if next_index == 0:
            return None
    ```

    Args:
        redis (redis.asyncio.client.Redis): The redis client
        target_touch_uid (str): the send uid of the touch you are scanning for
        start_index (int): the index to start scanning from. If negative, this
            will be interpreted as an index from the end of the list, so e.g.,
            -1 will start scanning from the end of the list.
        max_count (int): the maximum number of items to scan through

    Returns:
        `(bool, int, Optional[str])`: a tuple of `(found, next_index, user_sub)`
            where `found` is `True` if the touch was found, `False` otherwise, `next_index`
            is the next index to start scanning from or 0 if scanning has
            finished, and `user_sub` is the sub of the user associated with the
            touch, if it was found.

    Raises:
        NoScriptError: If the script is not loaded into redis
    """
    res = await redis.evalsha(
        TOUCH_TO_SEND_SCANNER_LUA_SCRIPT_HASH,
        0,
        target_touch_uid,
        start_index,
        max_count,
    )
    if res is redis:
        return None
    assert isinstance(res, list), res
    assert len(res) == 3, res
    assert isinstance(res[0], int), res
    assert isinstance(res[1], int), res
    assert isinstance(res[2], (str, type(None))), res
    return res[0] == 1, res[1], res[2]
