;(function () {

  // Initial Setup
  // -------------

  var root = this;
  var _ = root._;
  var Backbone = root.Backbone;

  // Initialize the Ext namespace
  Backbone.Ext || (Backbone.Ext = {});

  // Backbone.Ext.View
  // -----------------

  // Extends the default Backbone.View with placeholder methods for clearing
  // the element and doing any event handler cleanup. It also ensures that
  // all view elements will have a `data-cid` attribute for referencing views
  // so we can direct delegated events to the correct child view.
  var View = Backbone.Ext.View = Backbone.View.extend({
    // The default release method checks for a `model` or `collection` and
    // unbinds events associated with `this` context.
    release: function () {
      if (this.model) this.model.off(null, null, this);
      if (this.collection) this.collection.off(null, null, this);
      return this;  
    },

    // The default clear method just sets the html to an empty string.
    clear: function () {
      this.$el.html('');
      return this;
    },

    // Overriden `setElement` method which adds the `data-cid` attribute.
    setElement: function (element, delegate) {
      Backbone.View.prototype.setElement.call(this, element, delegate);

      // Add a custom attribute to the element for delegation tracking
      this.$el.attr('data-cid', this.cid);
      return this;
    }
  });

  // Static method to setup proxy methods to $el.
  View.enableElementProxy = function () {
    var methods = _.flatten(arguments);
    _.each(methods, function (method) {
      View.prototype[method] = function () {
        this.$el[method].apply(this.$el, _.toArray(arguments));
        return this;
      };
    });
  };

  // jQuery/Zepto methods to proxy. This will let us just call `view.show()`
  // and have it show the views element.
  View.enableElementProxy('show', 'hide');


  // Backbone.Ext.CompositeView
  // --------------------------

  // A special view that lets you register child views that can then have
  // their events delegated. This lets you write your child views like they
  // are handling their own events, but have the parent CompositeView act as
  // a delegate so you don't have thousands of event handlers for views with
  // many children. It also provides a method for replacing placeholder
  // elements with the correct child views.

  // Cached regex to split event keys.
  var delegateEventSplitter = /^(\S+)\s*(.*)$/;

  var CompositeView = Backbone.Ext.CompositeView = View.extend({
    // Override the default constructor to initialize internal variables.
    constructor: function (options) {
      this._reset();
      Backbone.Ext.View.call(this, options);
    },

    // Release child views and clear caches
    release: function () {
      this._releaseChildren();
      this._reset();
      return View.prototype.release.call(this);
    },

    // Clear child views first
    clear: function () {
      this._clearChildren();
      return View.prototype.clear.call(this);
    },

    // Registers a view as a child. If a selector is provided,
    // `undelegateEvents` will be called on it since that means its events
    // need to be delegated via the parent instead.
    registerChild: function (view, options) {
      options || (options = {});
      var cid = view.cid;
      var selector = options.selector;
      if (selector) this._selectorByCid[cid] = selector, view.undelegateEvents();
      if (!this._childrenByCid[cid]) this.children.push(view); 
      return this._childrenByCid[cid] = view;
    },

    // Removes a child from the internal cache.
    deregisterChild: function (view) {
      var cid = view.cid;
      var index = _.indexOf(this.children, view);
      if (~index) {
        delete this._childrenByCid[cid];
        delete this._selectorByCid[cid];
        this.children.splice(index, 1);
      }
      return view;
    },

    // Finds all placeholders and replaces them with the specified child views.
    placeChildren: function (options) {
      options || (options = {});
      var byCid = this._childrenByCid;
      this.$('view').each(function () {
        var $el = $(this), cid = $el.attr('data-cid');
        var view = byCid[cid];
        if (view) {
          if (options.render) view.render();
          $el.replaceWith(view.el);
        }
      });
      return this;
    },

    // Call `delegateChildEvents` also.
    delegateEvents: function (events) {
      Backbone.Ext.View.prototype.delegateEvents.call(this, events);
      this.delegateChildEvents();
    },

    // Loops over the registered children and sets up delegations on a first-
    // come-first-serve basis. Since view `events` can be a function, and thus
    // generated dynamically, this will use whatever the first view for a
    // selector provides and ignore the others.
    delegateChildEvents: function () {
      this.undelegateChildEvents();
      var delegations = {}, i, view;
      for (i = 0; (view = this.children[i]); i++) {
        var prefix = this._selectorByCid[view.cid];
        if (!prefix || delegations[prefix]) continue;
        delegations[prefix] = true;
        var events = getValue(view, 'events');
        for (var key in events) {
          var method = events[key];
          var match = key.match(delegateEventSplitter);
          var eventName = match[1] + '.delegateEvents' + this.cid + '.child';
          var selector = match[2] ? prefix + ' ' + match[2] : prefix;
          var proxy = _.bind(this._childEventProxy, this, prefix, method);
          this.$el.delegate(selector, eventName, proxy);
        }
      }
    },

    // Remove all delegations for child views.
    undelegateChildEvents: function () {
      this.$el.unbind('.delegateEvents' + this.cid + '.child');
    },

    // All delegations for child views run through this handler, which is
    // curried with the selector and method. It grabs the cid from the
    // target element and calls the method on the appropriate view.
    _childEventProxy: function (selector, method, e) {
      var cid = $(e.currentTarget).closest(selector).attr('data-cid')
      var view = this._childrenByCid[cid];
      if (!_.isFunction(method)) method = view[method];
      return method.call(view, e);
    },

    // Call `release` on all the children.
    _releaseChildren: function () {
      _.invoke(this.children, 'release');
    },

    // Call `clear` on all the children and detach it from the DOM so they
    // dont't lose their event handlers.
    _clearChildren: function () {
      var view, i;
      for (i = 0; (view = this.children[i]); i++) {
        view.clear();
        view.$el.detach();
      }
    },

    // Reset the internal cache of children.
    _reset: function () {
      this.children = [];
      this._childrenByCid = {};
      this._selectorByCid = {};
    }
  });

  // Alias `deregisterChild` to `unregisterChild`.
  CompositeView.prototype.unregisterChild = CompositeView.prototype.deregisterChild;

  // If the value is a function, return the result of the function.
  var getValue = function(object, prop) {
    if (!(object && object[prop])) return null;
    return _.isFunction(object[prop]) ? object[prop]() : object[prop];
  };

}).call(this);
