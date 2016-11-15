# Wicket MultiSelect

License: [Apache 2.0](http://www.apache.org/licenses/LICENSE-2.0), current version: 0.8

The Wicket MultiSelect component is a replacement for the
[Palette component](http://examples6x.wicket.apache.org/compref/wicket/bookmarkable/org.apache.wicket.examples.compref.PalettePage) component in
Wicket extensions. We needed some additional features, such as client-side filtering, vertical arrangement of the select-panels and some more control in
styling, which were difficult to implement in the original Palette, since it is rendered into a rigid table-structure in HTML.

For our project we only required the component to work on the latest versions of Firefox, Chrome, Internet Explorer and Edge, so this component will not work
on older browsers. It utilizes some HTML 5 features such as [Web Workers](https://www.w3.org/TR/workers/) and
[data-* attributes](https://www.w3.org/TR/2011/WD-html5-20110525/elements.html#embedding-custom-non-visible-data-with-the-data-attributes) and the project is
still on [Wicket 6](https://wicket.apache.org/start/wicket-6.x.html), but should be easy to port over to Wicket 7 and beyond.


#### Current status:

Component is already in use in one of our products, but there are some features we still want to include before the 1.0 release.
