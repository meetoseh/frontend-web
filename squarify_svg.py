"""
Convenient module to take a viewBox for an svg that was cropped via
`svgcrop.com` and make it square by padding the smaller dimension
equally.

Example:

```
> python squarify_svg.py 15 25 50 30
15 15 50 50
```
"""
import argparse
import decimal


def main():
    argument_parser = argparse.ArgumentParser()
    argument_parser.add_argument("x", type=decimal.Decimal)
    argument_parser.add_argument("y", type=decimal.Decimal)
    argument_parser.add_argument("width", type=decimal.Decimal)
    argument_parser.add_argument("height", type=decimal.Decimal)
    args = argument_parser.parse_args()

    squarify_svg(args.x, args.y, args.width, args.height)


def squarify_svg(x, y, width, height):
    if width > height:
        diff = width - height
        y -= diff / 2
        height += diff
    else:
        diff = height - width
        x -= diff / 2
        width += diff

    print(f"{x} {y} {width} {height}")


if __name__ == "__main__":
    main()
