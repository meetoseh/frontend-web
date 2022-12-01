import os


FONTS = [
    ("OpenSans", "Open Sans"),
    ("OpenSans_Condensed", "Open Sans Condensed"),
    ("OpenSans_SemiCondensed", "Open Sans SemiCondensed"),
    ("RobotoMono", "Roboto Mono"),
]

WEIGHTS = {
    "Thin": 100,
    "ExtraLight": 200,
    "Light": 300,
    "Regular": 400,
    "Medium": 500,
    "SemiBold": 600,
    "Bold": 700,
    "ExtraBold": 800,
}
DEFAULT_WEIGHT = 400

STYLES = {"Italic": "italic"}
DEFAULT_STYLE = "normal"


def main():
    with open(os.path.join("src", "assets", "fonts.css"), "w") as f:
        for diskname, name in FONTS:
            for file in os.listdir(os.path.join("src", "assets", "fonts", diskname)):
                if file.startswith(f"{diskname}-") and file.endswith(".ttf"):
                    suffix = file[len(diskname) + 1 : -4]

                    weight = DEFAULT_WEIGHT
                    for identifier, value in WEIGHTS.items():
                        if identifier in suffix:
                            weight = value
                            break

                    style = DEFAULT_STYLE
                    for identifier, value in STYLES.items():
                        if identifier in suffix:
                            style = value
                            break

                    print("@font-face {", file=f)
                    print(f"  font-family: '{name}';", file=f)
                    print(f"  font-style: {style};", file=f)
                    print(f"  font-weight: {weight};", file=f)
                    print(f"  font-display: swap;", file=f)
                    print(
                        f"  src: url('fonts/{diskname}/{file}') format('truetype');",
                        file=f,
                    )
                    print("}", file=f)


if __name__ == "__main__":
    main()
