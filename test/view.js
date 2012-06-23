$(function () {

  var model, collection, view;

  var View = Backbone.Ext.View.extend({
    initialize: function () {
      this.model.on('change', this.handler, this);
      this.collection.on('change', this.handler, this);
    },
    render: function () {
      this.$el.html('<b>Testing</b>');
      return this;
    },
    handler: function () {
      count += 1;
    },
  });

  module('Backbone.Ext.View', {
    setup: function () {
      count = 0;
      collection = new Backbone.Collection();
      model = new Backbone.Model();
      view = new View({
        model: model,
        collection: collection
      });
    }
  });

  test('element', 1, function () {
    equal(view.cid, view.$el.attr('data-cid'));
  });

  test('clear', 1, function () {
    view.render().clear();
    equal(view.el.innerHTML, '');
  });

  test('release', 1, function () {
    model.trigger('change');
    collection.trigger('change');

    view.release();

    model.trigger('change');
    collection.trigger('change');

    equal(count, 2);
  });

  test('element proxy', 3, function () {
    view.$el.appendTo('body');

    view.hide();
    ok(!view.$el.is(':visible'));

    view.show();
    ok(view.$el.is(':visible'));

    Backbone.Ext.View.enableElementProxy('fadeIn', 'fadeOut');
    ok(_.isFunction(view.fadeIn) && _.isFunction(view.fadeOut))
  });

});
