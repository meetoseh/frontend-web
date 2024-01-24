# Responsive Helpers

Our layouts are generally designed to avoid any vertical scrolling. This
doesn't quite mesh with the standard html/css responsiveness patterns,
which are largely focused around the horizontal aspect with an unlimited
amount of vertical space.

We also want to keep this code as in sync with react native as possible which
restricts us from using e.g. css math helpers: we would have to convert those
into javascript calculations for react native, and the javascript calculations
work on both the web and react native, just more complicated than necessary
for the web.

Vertical scaling is communicated from design to development as a priority list
of where additional space should go.

For example, consider a screen with 3 components, two of which are just margins.
For vertical scaling we can treat components and margins as the same thing, and
label them A,B,C,D,E.

- A is typically 100px (but may differ under accessibility settings like font sizing)
- B needs at least 24px
- C needs at least 350px
- D needs at least 40px
- E is typically 80px (but may differ under accessibility settings like font sizing)

Thus, this screen typically needs 594px height before we need to enable vertical
scrolling. However, we almost never want a 700px screen to have an extra 106px
of emptiness at the bottom, and only on the absolute most simple screens would we
want 53px top and bottom. Instead, we might want to handle it as follows:

- priority 1: C goes to 475px
- priority 2: B goes to 48px, D goes to 80px
- priority 3: scale A and E equally

what this means is from 594px to 719px, all the additional height should
be used to scale C. For example, at 600px, C is 356px. At 700px,
C is 456px. At 719px, C is 475px. Then, we split px proportionally to B
and D such that at the end B is 48px and D is 80px. This priority can
allocate up to 64px. At 751px, B is 36px and D is 60px (both halfway to
their target).

Finally, after 783px, we move additional height to A and E evenly.

If you assume `100vh` is a close enough approximation to window height (it is
not), then e.g. A can be expressed as:

```css
.a {
  height: 100px;
}

@media screen and (min-height: 783px) {
  .a {
    height: calc(100px + 100vh - 783px);
  }
}
```
