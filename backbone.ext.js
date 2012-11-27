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
    // The default dispose method checks for a `model` or `collection` and
    // unbinds events associated with `this` context.
    dispose: function () {
      if (this.model) {
        this.model.off(null, null, this);
        this.model = null;
      }
      if (this.collection) {
        this.collection.off(null, null, this);
        this.collection = null;
      }
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
    dispose: function () {
      this._disposeChildren();
      this._reset();
      return View.prototype.dispose.call(this);
    },

    // Clear child views first
    clear: function () {
      this._clearChildren();
      return View.prototype.clear.call(this);
    },

    // Generates placeholder html for the supplied view. This should be called
    // in templates.
    placeholderFor: function (view) {
      return '<view data-cid="' + view.cid + '" />';
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
      var cid = $(e.currentTarget).closest(selector + '[data-cid]').attr('data-cid')
      var view = this._childrenByCid[cid];
      if (!_.isFunction(method)) method = view[method];
      return method.call(view, e);
    },

    // Call `dispose` on all the children.
    _disposeChildren: function () {
      _.invoke(this.children, 'dispose');
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

  // Backbone.Ext.CollectionView
  // ---------------------

  // A common pattern is to have a view that represents the state of a
  // collection and its models. Given a `modelView` and `delegationSelector`,
  // this will create a series of views that always stay synced with the
  // supplied collection and delegate the child views' events. This is designed
  // to be lightweight yet powerful enough to not require subclassing. In most 
  // cases, it should be created directly by a parent CompositeView.
  // Consequently, it implements `initialize` and `render` methods. So if 
  // subclassing is required, make sure to keep that in mind.

  // A list of additional top level options for CollectionViews.
  var collViewOptions = ['modelView', 'emptyTemplate', 'delegationSelector'];
  
  var CollectionView = Backbone.Ext.CollectionView = CompositeView.extend({
    // Override to look out for additional top level options.
    _configure: function (options) {
      CompositeView.prototype._configure.call(this, options);
      _.each(collViewOptions, function (attr) {
        if (options[attr]) this[attr] = options[attr];
      }, this);
    },

    // Implement an `initialize` method to setup child views and add event
    // handlers to the collection.
    initialize: function () {
      this.syncViews();
      this.collection
        .on('add', this._addModel, this)
        .on('remove', this._removeModel, this)
        .on('reset', this._resetCollection, this);
    },

    // Implement a `render` methods to append and render all child views
    render: function () {
      if (this.collection.length === 0) return this.renderEmpty();
      this.clear();
      _.each(this.children, function (child) {
        this.$el.append(child.render().el);
      }, this);
      return this;
    },

    // Registers a child view for each model in the collection.
    syncViews: function () {
      this._reset();
      this.collection.each(function (model) {
        var view = new this.modelView({ model: model });
        this.registerChild(view, { selector: this.delegationSelector });
      }, this);
    },

    // Renders the `emptyView` and sets it as the el's html.
    renderEmpty: function () {
      var empty = this.emptyTemplate;
      var html = _.isFunction(empty) ? empty.call(this) : empty;
      this.clear().$el.html(html);
      return this;
    },

    // Handler to respond to `add` events on the collection. Creates, registers,
    // renders, and inserts a new child view for the new model.
    _addModel: function (model, collection, options) {
      // Clear in case an `emptyView` is there.
      if (collection.length === 1) this.clear();
      var index = options.index;
      var view = new this.modelView({ model: model });
      this.registerChild(view, { selector: this.delegationSelector, at: index });

      var el = view.render().el;
      if (index === 0) this.$el.prepend(el);
      else if (index === this.children.length - 1) this.$el.append(el);
      else this.$el.children().eq(index).before(el);
    },

    // Handler to respond to `remove` events on the collection. Deregisters,
    // removes, and disposes the child view associated with the model.
    _removeModel: function (model, collection, options) {
      var view = this.deregisterChild(null, { at: options.index });
      view.remove().dispose();
      if (collection.length === 0) this.renderEmpty();
    },

    // Handler to respond to `reset` events on the collection. Removes and
    // disposes the old views, resyncs the views, and rerenders.
    _resetCollection: function (collection) {
      _.each(this.children, function (child) {
        child.remove().dispose();
      });
      this.syncViews();
      this.render();
    }
  });

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
      this.routers = [];
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
        _.each(this.routers, function (pair) {
          _.any(pair.handlers, function (handler) {
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
      var pair = _.find(this.routers, function (pair) {
        return pair.router === router;
      });
      if (pair) {
        Array.prototype.unshift.apply(pair.handlers, handlers);
      } else {
        pair = {router: router, handlers: handlers};
        this.routers.push(pair);
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
