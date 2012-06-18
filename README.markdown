# Backbone Extensions

## Backbone.Ext.View

### #release()
Model cleanup. By default, checks for a `model` or `collection` and unbinds all
events on `this` context.

### #clear()
Sets html to an empty string.

### #setElement(element, [delegate])
Overrides the default implementation to add a `data-cid` attribute on the
view's `el`. This is needed during child-view event delegation for routing the
event to the correct view.

### enableElementProxy(methods*)
Proxy methods to each view's `$el`. Default methods are `show` and `hide`.


## Backbone.Ext.CompositeView

### #release()
Calls `release` on all child view also.

### #clear()
Calls `clear` on each child view, and also detaches them from the DOM so they
won't lose any of their event handlers.

### #registerChild(view, [options])
Registers the view as a child. Calling `relase` or `clear` on the parent will
also call it on any registered children. If `options.selector` is set, all
child views registered with the same selector will have their events delegated
by the parent view rather than having handlers on individual children. Returns
the supplied view.

### #deregisterChild(view)
Deregisters a view as a child. Returns the supplied view. Aliased to
`unregisterChild`.

### #placeChildren([options])
Finds placeholder elements and replaces them with the correct view. Placeholder
elements are in the form `<view data-cid="view.cid" />`. If `options.render`
is set, `render` will be called on each child view as it is placed in the DOM.

### #delegateChildEvents()
Sets up event delegations for all child views registered with a selector.

### #undelegateChildEvents()
Removes event delegations for child views.

### #delegateEvents([events])
Overriden to also call `delegateChildEvents`.


## Caveats
* `undelegateEvents` is called on all child view registered with a selector,
but `delegateEvents` will still be called on child views when they are
instanciated. It seems a little wasteful to delegate events and then
immediately undelegate them, but it's unavoidable since it is part of the
`Backbone.View` constructor.
* Events are delegated based upon the `events` hash of the least recently
registered child for a given selector. If a view's events are a function that
returns a dynamic hash based upon some internal state, you're gonna have a bad
time.
* Use simple selectors, namely classes or tags, when registering a child. The
target child view is determined by calling `$(e.currentTarget).closest(selector)`
within the event handler. If you use something like the child selector (`a > b`),
you're gonna have a bad time.


## Examples
https://natefaubion.github.com/backbone.ext/examples/example.html
