import io
from dataclasses import dataclass
import math
from typing import List, Literal
import cairosvg
import os
from PIL import Image


@dataclass
class Size:
    w: float
    h: float


@dataclass
class Point:
    x: float
    y: float


@dataclass
class PathInfo:
    start_angle_degrees: float
    start: Point
    end_angle_degrees: float
    end: Point
    large_arc_flag: int
    sweep_flag: int


@dataclass
class PathMarker:
    start: str
    end: str


@dataclass
class Svg:
    src: str
    view_box: Size


ANGLE_PROPORTIONS_BY_GOAL = [
    [],
    [1],
    [1, 1],
    [0.7, 1, 0.7],
    [0.8, 1, 1, 0.8],
    [0.9, 1, 1.2, 1, 0.9],
    [1, 1, 1, 1, 1, 1],
    [0.9, 1, 1, 1.2, 1.1, 1, 0.9],
]

FONT_ADJUSTS_BY_FILLED_CAIRO: List[Point] = [
    Point(1, -3),
    Point(-2, -3),
    Point(1, -3),
    Point(1, -3),
    Point(-1, -3),
    Point(0, -3),
    Point(0, -3),
    Point(0, -3),
]

FONT_ADJUSTS_BY_FILLED_STANDARD: List[Point] = [
    Point(0, 3),
    Point(0, 4),
    Point(0, 3),
    Point(1, 3),
    Point(-2, 4),
    Point(0, 2),
    Point(-1, 3),
    Point(0, 4),
]


def get_angle_distance_cw(a: float, b: float) -> float:
    normalized_a = (a + 360) % 360
    normalized_b = (b + 360) % 360

    if normalized_a < normalized_b:
        return normalized_b - normalized_a
    return 360 - normalized_a + normalized_b


def make_svg(filled: int, goal: int, *, target: Literal["cairo", "standard"]) -> Svg:
    """Port of VisualGoal.tsx to Python.

    When targetting cairo, which does not render the end marker correctly using
    the normal technique, we instead use hard red (#ff0000) for the filled
    opacity and hard green (#00ff00) for the unfilled opacity, and its expected
    that after rasterizing you convert these to the correct colors (#EAEAEB,
    #FFFFFF at 35% opacity).
    """

    radius = 45
    stroke_width = 6
    view_box = Size(radius * 2 + stroke_width + 2, radius * 2 + stroke_width + 2)
    cx = view_box.w / 2
    cy = view_box.h / 2

    filled_color = "#EAEAEB" if target == "standard" else "#ff0000"
    filled_opacity = "1"
    unfilled_color = "#FFFFFF" if target == "standard" else "#00ff00"
    unfilled_opacity = "0.35" if target == "standard" else "1"

    def get_path_info() -> List[PathInfo]:
        cut_angle_degrees = 70
        spacer_angle_degrees = 2
        remaining_angle_degrees = (
            360 - cut_angle_degrees - (goal - 1) * spacer_angle_degrees
        )
        part_angle_degrees = remaining_angle_degrees / goal

        angle_proportions = ANGLE_PROPORTIONS_BY_GOAL[goal]
        angle_proportions_sum = sum(angle_proportions)
        angle_by_part_idx = [
            (p / angle_proportions_sum) * part_angle_degrees * goal
            for p in angle_proportions
        ]

        paths = []
        next_start_angle_cw_from_bottom = cut_angle_degrees / 2
        for idx in range(goal):
            start_angle_cw_from_bottom = next_start_angle_cw_from_bottom
            next_start_angle_cw_from_bottom += (
                angle_by_part_idx[idx] + spacer_angle_degrees
            )
            start_angle_std = (start_angle_cw_from_bottom + 90) % 360

            start_position = Point(
                cx + radius * math.cos((start_angle_std * math.pi) / 180),
                cy + radius * math.sin((start_angle_std * math.pi) / 180),
            )
            end_angle_std = (start_angle_std + angle_by_part_idx[idx]) % 360
            end_position = Point(
                cx + radius * math.cos((end_angle_std * math.pi) / 180),
                cy + radius * math.sin((end_angle_std * math.pi) / 180),
            )
            large_arc_flag = (
                1 if get_angle_distance_cw(start_angle_std, end_angle_std) > 180 else 0
            )
            sweep_flag = 1

            paths.append(
                PathInfo(
                    start_angle_degrees=start_angle_std,
                    start=start_position,
                    end_angle_degrees=end_angle_std,
                    end=end_position,
                    large_arc_flag=large_arc_flag,
                    sweep_flag=sweep_flag,
                )
            )
        return paths

    path_info = get_path_info()

    result = io.StringIO()
    result.write(
        f"""
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view_box.w} {view_box.h}">
    <style>
        .text {{
            font-family: "Open Sans SemiBold";
            font-size: 48px;
        }}
    </style>
    <defs>
        <marker id="roundFilled" viewBox="-1 -1 2 2" markerWidth="1" orient="auto">
            <circle r="1" fill="{filled_color}" fill-opacity="{filled_opacity}" />
        </marker>"""
    )

    if target == "standard":
        result.write(
            f"""
        <marker id="roundUnfilledStart" viewBox="-1 -1 2 2" markerWidth="1" orient="auto">
            <path
                d="M0.002 -1A1 1 0 0 0 0.002 1Z"
                fill="{unfilled_color}"
                fill-opacity="{unfilled_opacity}"
                stroke="none"
            />
        </marker>
        <marker id="roundUnfilledEnd" viewBox="-1 -1 2 2" markerWidth="1" orient="auto">
            <path
                d="M-0.002 1A1 1 0 0 0 -0.002 -1Z"
                fill="{unfilled_color}"
                fill-opacity="{unfilled_opacity}"
                stroke="none"
            />
        </marker>"""
        )
    else:
        result.write(
            f"""
        <marker id="roundUnfilledStart" viewBox="-1 -1 2 2" markerWidth="1" orient="auto">
            <circle r="1" fill="{unfilled_color}" fill-opacity="{unfilled_opacity}" />
        </marker>
        <marker id="roundUnfilledEnd" viewBox="-1 -1 2 2" markerWidth="1" orient="auto">
            <circle r="1" fill="{unfilled_color}" fill-opacity="{unfilled_opacity}" />
        </marker>"""
        )

    if filled == goal:
        result.write(
            """
        <linearGradient id="bknd" x1="0" y1="50%" x2="100%" y2="50%" gradientUnits="userSpaceOnUse">
            <stop stop-color="#5AD6AD"/>
            <stop offset="0.552083" stop-color="#2F95C1"/>
            <stop offset="0.921875" stop-color="#4362A9"/>
        </linearGradient>
            """
        )

    result.write(
        """
    </defs>
"""
    )
    for idx, segment in enumerate(path_info):
        is_filled = idx < filled
        marker = PathMarker(
            start="url(#roundFilled)" if is_filled else "url(#roundUnfilledStart)",
            end="url(#roundFilled)" if is_filled else "url(#roundUnfilledEnd)",
        )

        result.write(
            f"""
    <path
        d="M{segment.start.x} {segment.start.y} A{radius} {radius} 0 {segment.large_arc_flag} {segment.sweep_flag} {segment.end.x} {segment.end.y}"
        stroke="{filled_color if is_filled else unfilled_color}"
        stroke-opacity="{filled_opacity if is_filled else unfilled_opacity}"
        stroke-width="{stroke_width}"
        fill="none"
"""
        )
        if idx == 0:
            result.write(f'        marker-start="{marker.start}"\n')
        if idx == len(path_info) - 1:
            result.write(f'        marker-end="{marker.end}"\n')
        result.write("    />\n")

    center_radius = radius - stroke_width / 2 - 2
    adjust = (
        FONT_ADJUSTS_BY_FILLED_STANDARD[filled]
        if target == "standard"
        else FONT_ADJUSTS_BY_FILLED_CAIRO[filled]
    )
    result.write(
        f"""
    <circle cx="{cx}" cy="{cy}" r="{center_radius}" fill="{'#44b2a1cc' if goal != filled else 'url(#bknd)'}" />
    <text x="{cx + adjust.x}" y="{cy + adjust.y}" text-anchor="middle" text-alignment="middle" dominant-baseline="middle" fill="#eaeaeb" class="text">
        {filled}
    </text>
"""
    )
    if goal == filled:
        result.write(
            f"""
    <g transform="translate(65, 25) scale(0.65)">
        <path d="M7.37238 1.03238C7.48941 0.631134 7.98519 0.631134 8.10222 1.03238L8.78844 3.38756C8.93948 3.90528 9.19396 4.37569 9.53172 4.76148C9.86948 5.14728 10.2812 5.43786 10.7343 5.6102L12.794 6.39445C13.1451 6.5282 13.1451 7.0948 12.794 7.22855L10.7332 8.0128C10.2802 8.18542 9.86864 8.47626 9.53106 8.86227C9.19349 9.24828 8.93923 9.71884 8.78844 10.2367L8.10222 12.5906C8.07699 12.6785 8.02812 12.755 7.96259 12.8092C7.89706 12.8635 7.81821 12.8927 7.7373 12.8927C7.65639 12.8927 7.57754 12.8635 7.51201 12.8092C7.44648 12.755 7.39761 12.6785 7.37238 12.5906L6.68616 10.2354C6.53522 9.71785 6.2809 9.24753 5.94334 8.86174C5.60577 8.47595 5.19424 8.1853 4.74135 8.0128L2.68057 7.22855C2.60369 7.19971 2.53674 7.14387 2.48928 7.06897C2.44181 6.99408 2.41626 6.90397 2.41626 6.8115C2.41626 6.71903 2.44181 6.62892 2.48928 6.55402C2.53674 6.47913 2.60369 6.42328 2.68057 6.39445L4.74135 5.6102C5.19424 5.4377 5.60577 5.14705 5.94334 4.76126C6.2809 4.37547 6.53522 3.90515 6.68616 3.38756L7.37238 1.03238Z" fill="#EAEAEB"/>
    </g>
    <g transform="translate(60, 65) scale(0.5)">
        <path d="M7.37238 1.03238C7.48941 0.631134 7.98519 0.631134 8.10222 1.03238L8.78844 3.38756C8.93948 3.90528 9.19396 4.37569 9.53172 4.76148C9.86948 5.14728 10.2812 5.43786 10.7343 5.6102L12.794 6.39445C13.1451 6.5282 13.1451 7.0948 12.794 7.22855L10.7332 8.0128C10.2802 8.18542 9.86864 8.47626 9.53106 8.86227C9.19349 9.24828 8.93923 9.71884 8.78844 10.2367L8.10222 12.5906C8.07699 12.6785 8.02812 12.755 7.96259 12.8092C7.89706 12.8635 7.81821 12.8927 7.7373 12.8927C7.65639 12.8927 7.57754 12.8635 7.51201 12.8092C7.44648 12.755 7.39761 12.6785 7.37238 12.5906L6.68616 10.2354C6.53522 9.71785 6.2809 9.24753 5.94334 8.86174C5.60577 8.47595 5.19424 8.1853 4.74135 8.0128L2.68057 7.22855C2.60369 7.19971 2.53674 7.14387 2.48928 7.06897C2.44181 6.99408 2.41626 6.90397 2.41626 6.8115C2.41626 6.71903 2.44181 6.62892 2.48928 6.55402C2.53674 6.47913 2.60369 6.42328 2.68057 6.39445L4.74135 5.6102C5.19424 5.4377 5.60577 5.14705 5.94334 4.76126C6.2809 4.37547 6.53522 3.90515 6.68616 3.38756L7.37238 1.03238Z" fill="#EAEAEB"/>
    </g>
    <g transform="translate(30, 73) scale(0.4)">
        <path d="M7.37238 1.03238C7.48941 0.631134 7.98519 0.631134 8.10222 1.03238L8.78844 3.38756C8.93948 3.90528 9.19396 4.37569 9.53172 4.76148C9.86948 5.14728 10.2812 5.43786 10.7343 5.6102L12.794 6.39445C13.1451 6.5282 13.1451 7.0948 12.794 7.22855L10.7332 8.0128C10.2802 8.18542 9.86864 8.47626 9.53106 8.86227C9.19349 9.24828 8.93923 9.71884 8.78844 10.2367L8.10222 12.5906C8.07699 12.6785 8.02812 12.755 7.96259 12.8092C7.89706 12.8635 7.81821 12.8927 7.7373 12.8927C7.65639 12.8927 7.57754 12.8635 7.51201 12.8092C7.44648 12.755 7.39761 12.6785 7.37238 12.5906L6.68616 10.2354C6.53522 9.71785 6.2809 9.24753 5.94334 8.86174C5.60577 8.47595 5.19424 8.1853 4.74135 8.0128L2.68057 7.22855C2.60369 7.19971 2.53674 7.14387 2.48928 7.06897C2.44181 6.99408 2.41626 6.90397 2.41626 6.8115C2.41626 6.71903 2.44181 6.62892 2.48928 6.55402C2.53674 6.47913 2.60369 6.42328 2.68057 6.39445L4.74135 5.6102C5.19424 5.4377 5.60577 5.14705 5.94334 4.76126C6.2809 4.37547 6.53522 3.90515 6.68616 3.38756L7.37238 1.03238Z" fill="#EAEAEB"/>
    </g>
    <g transform="translate(17, 52) scale(0.64)">
        <path d="M7.37238 1.03238C7.48941 0.631134 7.98519 0.631134 8.10222 1.03238L8.78844 3.38756C8.93948 3.90528 9.19396 4.37569 9.53172 4.76148C9.86948 5.14728 10.2812 5.43786 10.7343 5.6102L12.794 6.39445C13.1451 6.5282 13.1451 7.0948 12.794 7.22855L10.7332 8.0128C10.2802 8.18542 9.86864 8.47626 9.53106 8.86227C9.19349 9.24828 8.93923 9.71884 8.78844 10.2367L8.10222 12.5906C8.07699 12.6785 8.02812 12.755 7.96259 12.8092C7.89706 12.8635 7.81821 12.8927 7.7373 12.8927C7.65639 12.8927 7.57754 12.8635 7.51201 12.8092C7.44648 12.755 7.39761 12.6785 7.37238 12.5906L6.68616 10.2354C6.53522 9.71785 6.2809 9.24753 5.94334 8.86174C5.60577 8.47595 5.19424 8.1853 4.74135 8.0128L2.68057 7.22855C2.60369 7.19971 2.53674 7.14387 2.48928 7.06897C2.44181 6.99408 2.41626 6.90397 2.41626 6.8115C2.41626 6.71903 2.44181 6.62892 2.48928 6.55402C2.53674 6.47913 2.60369 6.42328 2.68057 6.39445L4.74135 5.6102C5.19424 5.4377 5.60577 5.14705 5.94334 4.76126C6.2809 4.37547 6.53522 3.90515 6.68616 3.38756L7.37238 1.03238Z" fill="#EAEAEB"/>
    </g>
    <g transform="translate(28, 20) scale(0.33)">
        <path d="M7.37238 1.03238C7.48941 0.631134 7.98519 0.631134 8.10222 1.03238L8.78844 3.38756C8.93948 3.90528 9.19396 4.37569 9.53172 4.76148C9.86948 5.14728 10.2812 5.43786 10.7343 5.6102L12.794 6.39445C13.1451 6.5282 13.1451 7.0948 12.794 7.22855L10.7332 8.0128C10.2802 8.18542 9.86864 8.47626 9.53106 8.86227C9.19349 9.24828 8.93923 9.71884 8.78844 10.2367L8.10222 12.5906C8.07699 12.6785 8.02812 12.755 7.96259 12.8092C7.89706 12.8635 7.81821 12.8927 7.7373 12.8927C7.65639 12.8927 7.57754 12.8635 7.51201 12.8092C7.44648 12.755 7.39761 12.6785 7.37238 12.5906L6.68616 10.2354C6.53522 9.71785 6.2809 9.24753 5.94334 8.86174C5.60577 8.47595 5.19424 8.1853 4.74135 8.0128L2.68057 7.22855C2.60369 7.19971 2.53674 7.14387 2.48928 7.06897C2.44181 6.99408 2.41626 6.90397 2.41626 6.8115C2.41626 6.71903 2.44181 6.62892 2.48928 6.55402C2.53674 6.47913 2.60369 6.42328 2.68057 6.39445L4.74135 5.6102C5.19424 5.4377 5.60577 5.14705 5.94334 4.76126C6.2809 4.37547 6.53522 3.90515 6.68616 3.38756L7.37238 1.03238Z" fill="#EAEAEB"/>
    </g>
"""
        )
    result.write("</svg>\n")

    return Svg(
        src=result.getvalue(),
        view_box=view_box,
    )


def rasterize_svg(svg: Svg, height: int, outpath: str):
    width = int((height / svg.view_box.h) * svg.view_box.w)
    cairosvg.svg2png(
        bytestring=svg.src.encode("utf-8"),
        write_to=outpath,
        output_width=width,
        output_height=height,
        background_color="transparent",
    )

    # Convert the red and green to the correct colors
    img = Image.open(outpath)
    data = img.getdata()

    new_data = []
    for pixel in data:
        if pixel[0] > 0 and pixel[1] == 0 and pixel[2] == 0:
            # red to #EAEAEB, keep alpha
            new_data.append((234, 234, 235, pixel[3]))
        elif pixel[0] == 0 and pixel[1] > 0 and pixel[2] == 0:
            # green to #FFFFFF, multiply alpha by 0.35
            new_data.append((255, 255, 255, int(pixel[3] * 0.35)))
        else:
            # keep all other pixels
            new_data.append(pixel)

    img.putdata(new_data)
    img.save(outpath)


def main():
    os.makedirs("public/goalBadge", exist_ok=True)

    for goal in range(1, 8):
        for filled in range(0, goal + 1):
            # svgs are useful for mockups, but we don't serve them
            # std_svg = make_svg(filled, goal, target="standard")
            # with open(f"public/goalBadge/{filled}of{goal}.svg", "w") as f:
            #     f.write(std_svg.src)

            cairo_svg = make_svg(filled, goal, target="cairo")
            print("rasterizing", filled, "of", goal)
            rasterize_svg(cairo_svg, 192, f"public/goalBadge/{filled}of{goal}-192h.png")

    print("all done")


if __name__ == "__main__":
    main()
