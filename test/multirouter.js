$(function () {

  var router, calls;

  var RouterA = Backbone.Router.extend({
    routes: {
      'a/b/c': 'handlerA1',
      'a/*__': 'handlerA2'
    },
    handlerA1: function () { calls.push('A1'); },
    handlerA2: function () { calls.push('A2'); }
  });

  var RouterB = Backbone.Router.extend({
    routes: {
      'a/c/e':   'handlerB1',
      ':_/b/:_': 'handlerB2'
    },
    handlerB1: function () { calls.push('B1'); },
    handlerB2: function () { calls.push('B2'); }
  });

  var MultiRouter = Backbone.Ext.MultiRouter.extend({
    initialize: function () {
      this.a = this.createRouter(RouterA);
      this.b = this.createRouter(RouterB);
    },
    routes: {
      'a/b/c': 'handlerM1'
    },
    handlerM1: function () { calls.push('M1'); }
  });

  module('Backbone.Ext.MultiRouter', {
    setup: function () {
      calls  = [];
      router = new MultiRouter();
      Backbone.history.start();
    },
    teardown: function () {
      Backbone.history.stop();
      Backbone.history.handlers = [];
      window.location.hash = '';
    }
  });

  test('create router', 3, function () {
    ok(router.a instanceof RouterA);
    equal(router._handlers.length, 3);
    equal(router._handlers[1][1].length, 2);
  });

  test('routing', 3, function () {
    window.location.hash = 'a/c/e';
    Backbone.history.checkUrl();
    ok(_.contains(calls, 'A2') &&
       _.contains(calls, 'B1'));

    calls = [];
    window.location.hash = 'a/b/c';
    Backbone.history.checkUrl();
    ok(_.contains(calls, 'A1') &&
       _.contains(calls, 'B2') &&
       _.contains(calls, 'M1'));

    equal(_.indexOf(calls, 'M1'), 0);
  });

});
