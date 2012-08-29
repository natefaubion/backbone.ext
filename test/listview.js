$(function () {

  var values, listView;

  var ItemView = Backbone.Ext.View.extend({
    render: function () {
      this.$el.html(this.model.get('value'));
      return this;
    }
  });

  module('Backbone.Ext.ListView', {
    setup: function () {
      values = new Backbone.Collection();
      values.comparator = function (m) { return m.get('value'); };
      values.reset([
        {value: 0},
        {value: 2},
        {value: 3}
      ]);
      listView = new Backbone.Ext.ListView({
        modelView: ItemView,
        collection: values
      });
    }
  });

  test('sync views', 1, function () {
    equal(listView.children.length, values.length);
  });

  test('render children', 1, function () {
    listView.render();
    equal(listView.$el.children().length, listView.children.length);
  });

  test('add child', 4, function () {
    listView.render();
    values.add({value: 1});
    equal(listView.children.length, values.length)
    equal(listView.$el.children().length, values.length);
    equal(listView.children[1].model.get('value'), 1);
    equal(listView.$el.children().eq(1).text(), '1');
  });

  test('remove child', 4, function () {
    listView.render();
    values.remove(values.at(1));
    equal(listView.children.length, values.length)
    equal(listView.$el.children().length, values.length);
    equal(listView.children[1].model.get('value'), 3);
    equal(listView.$el.children().eq(1).text(), '3');
  });

  test('reset children', 4, function () {
    listView.render();
    values.reset([{value: 5}]);
    equal(listView.children.length, values.length)
    equal(listView.$el.children().length, values.length);
    equal(listView.children[0].model.get('value'), 5);
    equal(listView.$el.children().eq(0).text(), '5');
  });

})
