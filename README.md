# Wicket MultiSelect

### Work in progress...

The Wicket MultiSelect component is a replacement for the [Palette component](http://examples6x.wicket.apache.org/compref/wicket/bookmarkable/org.apache.wicket.examples.compref.PalettePage) in Wicket extensions. We developed this component because we ran into some limitations of the original component on an internal project.

For our project we only required the component to work on the latest versions of Firefox, Chrome, Internet Explorer and Edge, so this component will not work on older browsers. It utilizes some HTML 5 features such as [Web Workers](https://www.w3.org/TR/workers/) and [data-* attributes](https://www.w3.org/TR/2011/WD-html5-20110525/elements.html#embedding-custom-non-visible-data-with-the-data-attributes) and the project is still on [Wicket 6](https://wicket.apache.org/start/wicket-6.x.html), but should be easy to port over to Wicket 7 and beyond.

