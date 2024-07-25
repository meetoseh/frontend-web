export const FavoritesShortcut = ({ padRight, padTop }: { padRight: number; padTop: number }) => (
  <svg
    width={48 + padRight}
    height={48 + padTop}
    viewBox={`0 ${1 - padTop} ${48 + padRight} ${48 + padTop}`}
    fill="none"
    xmlns="http://www.w3.org/2000/svg">
    <circle cx="24" cy="25" r="16" fill="white" fillOpacity="0.35" />
    <path
      d="M24 32L22.84 30.9929C18.72 27.43 16 25.0725 16 22.1962C16 19.8387 17.936 18 20.4 18C21.792 18 23.128 18.618 24 19.5869C24.872 18.618 26.208 18 27.6 18C30.064 18 32 19.8387 32 22.1962C32 25.0725 29.28 27.43 25.16 30.9929L24 32Z"
      fill="white"
    />
  </svg>
);
