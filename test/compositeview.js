$(function () {

  var parent, child, model, count, cid;

  var ChildView = Backbone.Ext.View.extend({
    events: {
      'click a': 'clickHandler'
    },
    initialize: function () {
      this.model.on('change', this.handler, this);
    },
    render: function () {
      this.$el.html('<a href="#">Click</a>');
      return this;
    },
    clickHandler: function () {
      cid = this.cid;
      return false;
    },
    handler: function () {
      count += 1;
    }
  });

  var ParentView = Backbone.Ext.CompositeView.extend({
    events: {
      'click': 'handler'
    },
    initialize: function () {
      this.registerChild(child, {selector: 'div'});
      this.model.on('change', this.handler, this);
    },
    render: function () {
      this.$el.html('<view data-cid="' + child.cid + '" />');
      this.placeChildren({render: true});
      return this;
    },
    handler: function () {
      count += 1;
    }
  });

  module('Backbone.Ext.CompositeView', {
    setup: function () {
      count  = 0;
      cid    = '';
      model  = new Backbone.Model();
      child  = new ChildView({model: model});
      parent = new ParentView({model: model});
    }
  });

  test('register child', 1, function () {
    equal(parent.children.length, 1);
  });

  test('deregister child', 1, function () {
    parent.deregisterChild(child);
    equal(parent.children.length, 0);
  });

  test('place children', 2, function () {
    parent.render();
    equal(child.$el.parent()[0], parent.el);
    equal(child.$('a').length, 1);
  });

  test('delegate child events', 4, function () {
    parent.render();
    var pevents = parent.$el.data('events');
    var cevents = child.$el.data('events');

    ok(!cevents);
    equal(pevents.click.length, 2);
    equal(pevents.click.delegateCount, 1);
    
    child.$('a').click();
    equal(cid, child.cid);
  });

  test('undelegate child events', 2, function () {
    parent.undelegateChildEvents();
    var pevents = parent.$el.data('events');
    equal(pevents.click.length, 1);
    equal(pevents.click.delegateCount, 0);
  });

  test('clear', 2, function () {
    parent.render();
    parent.clear();
    equal(parent.el.innerHTML, '');
    equal(child.el.innerHTML, '');
  });

  test('release', 1, function () {
    model.trigger('change');
    parent.release();
    model.trigger('change');
    equal(count, 2);
  });

});
