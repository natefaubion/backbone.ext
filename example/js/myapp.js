// Backbone.Ext Example Application
// --------------------------------
// This example shows how use multiple routers and composite views. Obviously,
// this is a contrived example, and so the benefits of multiple routers may
// not be apparent. But as your application grows more complicated, multiple 
// routers let you modularize your code and use routers as a controller for
// each module.


// Initialize the application namespace
var App = {};

// Template namespace
App.templates = {};

// Find and compile application templates
$("script[type='text/tmpl']").each(function () {
  App.templates[this.getAttribute("data-name")] = _.template(this.innerHTML);
});

// Helper namespace
App.helpers = {};

// A default render method that just render the template.
App.helpers.defaultRender = function () {
  this.$el.html(this.template());
  return this;
}

// A default render method that also calls placeChildren
App.helpers.renderAndPlace = function () {
  this.$el.html(this.template());
  return this.placeChildren({render: true});
}

// A render method factory for passing on a model to the template.
App.helpers.modelRender = function (name) {
  return function () {
    var ctx = {};
    ctx[name] = this.model.toJSON();
    this.$el.html(this.template(ctx));
    return this;
  }
}

// AppRouter
// ---------
// The main MultiRouter for the application. It creates the different routers
// for the different sections of the site and manages toggling between sections.

App.AppRouter = Backbone.Ext.MultiRouter.extend({
  initialize: function (options) {
    var view = this.view = options.view;
    this.nav = this.createRouter(App.NavRouter, { view: view.navView });
    this.contacts = this.createRouter(App.ContactsRouter, { view: view.contactsView });
  },

  routes: {
    ""            : "index",
    ":section/*s" : "section"
  },

  index: function () {
    this.section("home");
  },

  section: function (name) {
    this.view.showSection(name)
  }
});

// AppView
// -------
// The main view for the application. Sets up all the child views.

App.AppView = Backbone.Ext.CompositeView.extend({
  id: "app",
  template: App.templates.app,

  initialize: function (options) {
    this.navView = this.registerChild(new App.NavView());
    this.homeView = this.registerChild(new App.HomeView());
    this.contactsView = this.registerChild(new App.ContactsView());
    this.currentView = null;
  },

  render: function () {
    this.$el.html(this.template());
    this.placeChildren();
    this.navView.render();
    return this;
  },

  showSection: function (name) {
    var nextView 
      = name === "home"     ? this.homeView
      : name === "contacts" ? this.contactsView
      : null;

    if (nextView !== this.currentView) {
      this.currentView && this.currentView.hide().clear();
      this.currentView = nextView.show().render();
    }

    return this.currentView;
  }
});

// NavRouter
// ---------
// Specifically handles changing the state of the navigation tabs. Note, that
// this is just a regular Router.

App.NavRouter = Backbone.Router.extend({
  initialize: function (options) {
    this.view = options.view;
  },

  routes: {
    ""            : "index",
    "contacts/*s" : "contacts"
  },

  index: function () {
    this.view.selectTab("home");
  },

  contacts: function () {
    this.view.selectTab("contacts")
  }
});

// NavView
// -------

App.NavView = Backbone.Ext.View.extend({
  tagName   : "ul",
  className : "nav",
  template  : App.templates.nav,
  render    : App.helpers.defaultRender,

  selectTab: function (name) {
    this.$el
      .find(".selected").removeClass("selected").end()
      .find("[data-name=" + name + "]").addClass("selected");
    return this;
  }
});

// HomeView
// --------

App.HomeView = Backbone.Ext.View.extend({
  className : "home-page",
  template  : App.templates.home,
  render    : App.helpers.defaultRender
});

// ContactsRouter
// --------------

App.ContactsRouter = Backbone.Router.extend({
  initialize: function (options) {
    this.view = options.view;
  },

  routes: {
    "contacts/"    : "index",
    "contacts/:id" : "contact"
  },

  index: function () {
    this.view.contactView.hide();
  },

  contact: function (id) {
    var contact = App.contacts.get(id);
    if (contact) {
      this.view.contactView.model = contact;
      this.view.contactView.render().show();
    }
  }
});

// ContactsView
// ------------

App.ContactsView = Backbone.Ext.CompositeView.extend({
  className : "contacts-page",
  template  : App.templates.contacts,

  initialize: function () {
    var listView = new Backbone.Ext.ListView({
      tagName: "ul",
      className: "contacts",
      modelView: App.ContactListItemView,
      delegationSelector: ".contact",
      collection: App.contacts
    });

    this.listView = this.registerChild(listView);
    this.contactView = this.registerChild(new App.ContactView());
    this.formView = this.registerChild(new App.ContactFormView());
  },

  render: function () {
    // Append the contact view to the body since it's more of a modal view.
    // Because of the way `clear` works on composite views, this will get
    // cleaned up when the parent gets cleaned up.
    $("body").append(this.contactView.hide().el);
    return App.helpers.renderAndPlace.call(this);
  }
});

// ContactListItemView
// -------------------

App.ContactListItemView = Backbone.Ext.View.extend({
  tagName   : "li",
  className : "contact",
  template  : App.templates.contactListItem,
  render    : App.helpers.modelRender("contact"),

  events: {
    "click .destroy": "_clickDestroy"
  },

  _clickDestroy: function () {
    // Since we aren't persisting anything, just remove the model from its
    // collection. Normally you would call model.destroy();
    this.model.collection.remove(this.model);
  }
});

// ContactView
// -----------

App.ContactView = Backbone.Ext.View.extend({
  className : "contact-card",
  template  : App.templates.contactCard,
  render    : App.helpers.modelRender("contact")
});

// ContactFormView
// ---------------

App.ContactFormView = Backbone.Ext.View.extend({
  tagName   : "form",
  className : "contact-form",
  template  : App.templates.contactForm,
  render    : App.helpers.defaultRender,

  events: {
    submit: "_submitHandler"
  },

  submit: function () {
    var inputs = this.$("input");
    var model = new App.Contact({
      id    : _.uniqueId(),
      name  : inputs.filter("[name=name]").val(),
      phone : inputs.filter("[name=phone]").val(),
      email : inputs.filter("[name=email]").val()
    });
    App.contacts.add(model);
    inputs.val("");
    return model;
  },

  _submitHandler: function (e) {
    e.preventDefault();
    this.submit();
  }
});

// Contact
// -------

App.Contact = Backbone.Model;

// ContactCollection
// -----------------

App.ContactCollection = Backbone.Collection.extend({
  model: App.Contact,
  comparator: function (model) {
    return model.get("name").toLowerCase();
  }
});

App.contacts = new App.ContactCollection();
