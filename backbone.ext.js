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
    },

    // Generates placeholder html for this particular view. This may be called
    // in a template for a CompositeView.
    placeholder: function () {
      return '<view data-cid="' + this.cid + '" />';
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
  // and have it show the view's element.
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
    // need to be delegated via the parent instead. Use tha `at` option to have
    // the view spliced into `children` at the specified index.
    registerChild: function (view, options) {
      options || (options = {});
      var cid = view.cid;
      var selector = options.selector;
      var index = options.at != null ? options.at : this.children.length;
      if (selector) this._selectorByCid[cid] = selector, view.undelegateEvents();
      if (!this._childrenByCid[cid]) this.children.splice(index, 0, view); 
      return this._childrenByCid[cid] = view;
    },

    // Removes a child from the internal cache. Passing `at` as an option will
    // deregister the child at the specified index within `children`. If an
    // `at` index is provided, the `view` argument will be ignored.
    deregisterChild: function (view, options) {
      options || (options = {});
      var index = options.at != null ? options.at : _.indexOf(this.children, view);
      var delView;
      if (~index) {
        delView = this.children[index];
        var cid = delView.cid;
        delete this._childrenByCid[cid];
        delete this._selectorByCid[cid];
        this.children.splice(index, 1);
      }
      return delView || false;
    },

    // Finds all placeholders and replaces them with the specified child views.
    placeChildren: function (options) {
      options || (options = {});
      var byCid = this._childrenByCid;
      var selector = this.placeholderSelector || Backbone.Ext.placeholderSelector;
      this.$(selector).each(function () {
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

  // Selector used to find placeholder tags. If you override the default
  // `placeholder` method on Backbone.Ext.View to spit out a different tag,
  // you should change this. You can also configure it on individual
  // CompositeViews by setting an attribute of the same name.
  Backbone.Ext.placeholderSelector = 'view';

  // Backbone.Ext.MultiRouter
  // ------------------------

  // Backbone.History only allows one callback per route, but for more modular
  // applications, it can be helpful to have multiple routers that may share
  // the same routes but update different parts of the application. Write your
  // routers as you normally would, then use MultiRouter to glue them
  // together.
  
  var MultiRouter = Backbone.Ext.MultiRouter = Backbone.Router.extend({
    // Override the default constructor to initialize internal variables.
    constructor: function (options) {
      this._handlers = [];
      Backbone.Router.call(this, options);
    },

    // Override so route calls run through our internal handler instead of
    // binding directly to Backbone.history
    route: function () {
      var args = arguments;
      this._bindHandlers(this, gatherHandlers(function () {
        Backbone.Router.prototype.route.apply(this, args);
      }, this));
      return this;
    },

    // Given a router class and options, creates and returns a new instance
    // whose routes run through our internal handler.
    createRouter: function (routerClass, options) {
      var router;
      var handlers = gatherHandlers(function () {
        router = new routerClass(options);
      }, this);
      this._bindHandlers(router, handlers);
      return router;
    },

    // Given a route regex, registers a callback on Backbone.history that will
    // scan through all our registered routers and invoke methods that match
    // the route. This uses `_.any` just like Backbone.history would, so only
    // only one route will fire _within_ each router.
    _route: function (route) {
      Backbone.history.route(route, _.bind(function (fragment) {
        _.each(this._handlers, function (pair) {
          _.any(pair[1], function (handler) {
            if (handler.route.test(fragment)) {
              handler.callback(fragment);
              return true;
            }
          });
        });
      }, this));
    },

    // Given a router and a set of handlers in the form of {route, handler},
    // push the handlers onto the internal cache and register the routes.
    _bindHandlers: function (router, handlers) {
      var pair = _.find(this._handlers, function (pair) {
        return pair[0] === router;
      });
      if (pair) {
        pair[1].unshift(handlers);
      } else {
        pair = [router, handlers];
        this._handlers.push(pair);
      }
      _.each(handlers, function (handler) {
        this._route(handler.route);
      }, this);
    }
  });

  // Swaps out Backbone.history.route with its own method that will gather
  // the routes registered during the invocation of `func`.
  var gatherHandlers = function (func, context) {
    Backbone.history || (Backbone.history = new Backbone.History);
    var history = {handlers: []};
    var oldRoute = Backbone.history.route;
    Backbone.history.route = function () {
      oldRoute.apply(history, arguments);
    };
    func.call(context || window);
    Backbone.history.route = oldRoute;
    return history.handlers;
  };

  // If the value is a function, return the result of the function.
  var getValue = function(object, prop) {
    if (!(object && object[prop])) return null;
    return _.isFunction(object[prop]) ? object[prop]() : object[prop];
  };

}).call(this);
