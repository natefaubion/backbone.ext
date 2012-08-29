# Backbone Extensions

## Examples
[Child view event delegation](http://natefaubion.github.com/backbone.ext/examples/example.html)

## Backbone.Ext.View
Extends the default `Backbone.View` with placeholder methods for clearing the
element and doing any event handler cleanup. It also ensures that all view
elements will have a `data-cid` attribute for referencing views so we can
direct delegated events to the correct child view.

### view.release()
Model cleanup. By default, checks for a `model` or `collection` and unbinds all
events on the `this` context.

### view.clear()
Sets `$el.html` to an empty string.

### view.setElement(element, [delegate])
Overrides the default implementation to add a `data-cid` attribute on the
view's `el`. This is needed during child-view event delegation for routing the
event to the correct view.

### Backbone.Ext.View.enableElementProxy(methods...)
Proxy methods to each view's `$el`. Default methods are `show` and `hide`.


## Backbone.Ext.CompositeView
A special view that lets you register child views that can then have their
events delegated. This lets you write your child views like they are handling
their own events, but have the parent CompositeView act as a delegate so you
don't have thousands of event handlers for views with many children. It also
provides a method for replacing placeholder elements with the correct child
views.

```js
var MyView = Backbone.Ext.CompositeView.extend({
  template: _.template("<%= this.placeholderFor(this.childView) %>"),
  initialize: function () {
    this.childView = this.registerChild(new ChildView(), {
      selector: ".child-view"
    });
  },
  render: function () {
    this.$el.html(this.template());
    this.placeChildren({render: true});
    return this;
  }
});
```

### view.release()
Calls `release` on all child views also.

### view.clear()
Calls `clear` on all child views and detaches them from the DOM so they won't
lose their event handlers.

### view.registerChild(childView, [options])
Registers the view as a child. Calling `relase` or `clear` on the parent will
also call it on any registered children. If `options.selector` is set, all
child views registered with the same selector will have their events delegated
by the parent view rather than having handlers on individual children. If
`options.at` is set, the child view will be inserted into `children` at the
specified index. Returns the supplied view.

Events are delegated based upon the `events` hash of the least recently
registered child for a given selector. If a view's events are a function that
returns a dynamic hash based upon some internal state, you should not use event
delegation.

Use simple, yet specific, selectors when registering a child. The selector is
used in two places: settings up event delegations on the parent and finding the
target child view. The target child view is determined by walking up the DOM
hierarchy using `$(e.currentTarget).closest(selector + '[data-cid]')` within
the event handler.

### view.deregisterChild(childView, [options])
Deregisters a view as a child. Returns the supplied view. Aliased to
`unregisterChild`. If `options.at` is set, the view at the specified index will
be removed and the first paramater will be ignored.

### view.placeChildren([options])
Finds placeholder elements and replaces them with the correct view. If 
`options.render` is set, `render` will be called on each child view as it is 
placed in the DOM.

### view.placeholderFor(childView)
Given a view, returns a placeholder html string that can be used in a template
and later replaced by `placeChildren`. The default implementation returns
a string in the form of `<view data-cid="view.cid" />` by default. The
`data-cid` attribute is used to lookup the correct replacement view. If you
override this method to return a different string, be sure to change
`placeholderSelector` also.

### view.delegateChildEvents()
Sets up event delegations for all child views registered with a selector.

### view.undelegateChildEvents()
Removes event delegations for child views.

### view.delegateEvents([events])
Overriden to also call `delegateChildEvents`.

### view.children
An array of the currently registered children. This should never be modified
directly. Use `registerChild` and `deregisterChild` instead.

### Backbone.Ext.CompositeView.placeholderSelector
A string selector used to find placeholder elements. Defaults to `'view'`. This
can be set globally on `Backbone.Ext.CompositeView` or overridden on individual
views by setting an attribute of the same name.


## Backbone.Ext.ListView
A common pattern is to have a view that represents the state of a collection
and its models. Given a `modelView` and `delegationSelector`, this will create
a list of a views that always stay synced with the supplied collection and
delegate the child views' events. This is designed to be lightweight yet
powerful enough to not require subclassing. In most cases, it should be created
directly by a parent CompositeView.  Consequently, it implements `initialize`
and `render` methods. So if subclassing is required, make sure to keep that in
mind.

```js
var listView = new Backbone.Ext.ListView({
  tagName: "ul",
  modelView: ListItemView,
  delegationSelector: "li",
  collection: myCollection
});
```

### view.syncViews()
Creates a child view for each model in the view's collection, and registers it
as a child. If a `delegationSelector` was supplied, it will make sure the
events are delegated by the list view. This is called automatically on view
initialization and on collection `refresh` events. You should not need to call
this manually unless overriding the default behavior.


## Backbone.Ext.MultiRouter
Backbone.History only allows one callback per route, but for more modular
applications, it can be helpful to have multiple routers that may share the
same or similar routes but update different parts of the application. Write
your routers as you normally would using `Backbone.Router`, then use
`MultiRouter` to glue them together. `MultiRouter` is also a router itself, so
it can have routes and callbacks of its own which will be executed before other
routes.

```js
var MyAppRouter = Backbone.Ext.MultiRouter.extend({
  initialize: function () {
    this.nav = this.createRouter(NavRouter);
    this.todos = this.createRouter(TodosRouter);
    this.notes = this.createRouter(NotesRouter);
  }
});
```

### multi.createRouter(routerClass, [options])
A factory method to instanciate a new router. To multiplex your routes, the
router must be created using `createRouter`. An optional `options` object will
be passed on to your new router.
