// Load the application once the DOM is ready, using `jQuery.ready`:
$(function(){

  // tweet Model
  // -------------------------------------------------------------------------------------------------------------------

  // Our basic **tweet** model has `content`, `order`, and `done` attributes.
  window.Countdown = Backbone.Model.extend({

    // Default attributes for the tweet.
    defaults: {
      author: "",
      content: "empty tweet...",
      done: false
    },

    // Ensure that each tweet created has `content`.
    initialize: function() {
      if (!this.get("content")) {
        this.set({"content": this.defaults.content});
      }
    },

    // Toggle the `done` state of this tweet item.
    toggle: function() {
      this.save({done: !this.get("done")});
    },

    // Remove this tweet from *localStorage* and delete its view.
    clear: function() {
      this.destroy();
      this.view.remove();
    }

  });

  // Countdown Collection
  // -------------------------------------------------------------------------------------------------------------------

  // The collection of tweets is backed by *localStorage* instead of a remote
  // server.
  window.CountdownList = Backbone.Collection.extend({

    // Reference to this collection's model.
    model: Countdown,

    // Save all of the tweet items under the `"tweets"` namespace.
    localStorage: new Store("tweets"),

    // Filter down the list of all tweet items that are finished.
    done: function() {
      return this.filter(function(tweet){ return tweet.get('done'); });
    },

    // Filter down the list to only tweet items that are still not finished.
    remaining: function() {
      return this.without.apply(this, this.done());
    },

    // We keep the Countdowns in sequential order, despite being saved by unordered
    // GUID in the database. This generates the next order number for new items.
    nextOrder: function() {
      if (!this.length) return 1;
      return this.last().get('order') + 1;
    },

    // Countdowns are sorted by their original insertion order.
    comparator: function(tweet) {
      return tweet.get('order');
    }

  });

  // Create our global collection of **Countdowns**.
  window.Countdowns = new CountdownList;

  // Countdown Item View
  // -------------------------------------------------------------------------------------------------------------------

  // The DOM element for a tweet item...
  window.CountdownView = Backbone.View.extend({

    //... is a list tag.
    tagName:  "li",

    // Cache the template function for a single item.
    template: _.template($('#tweet-template').html()),

    // The DOM events specific to an item.
    events: {
      "click .check"              : "toggleDone",
      "dblclick div.tweet-content" : "edit",
      "click span.tweet-destroy"   : "clear",
      "keypress .tweet-input"      : "updateOnEnter"
    },

    // The CountdownView listens for changes to its model, re-rendering. Since there's
    // a one-to-one correspondence between a **Countdown** and a **CountdownView** in this
    // app, we set a direct reference on the model for convenience.
    initialize: function() {
      _.bindAll(this, 'render', 'close');
      this.model.bind('change', this.render);
      this.model.view = this;
    },

    // Re-render the contents of the tweet item.
    render: function() {
      $(this.el).html(this.template(this.model.toJSON()));
      this.setContent();
      return this;
    },

    // To avoid XSS (not that it would be harmful in this particular app),
    // we use `jQuery.text` to set the contents of the tweet item.
    setContent: function() {
      var content = this.model.get('content');
      this.$('.tweet-content').text(content);
      this.input = this.$('.tweet-input');
      this.input.bind('blur', this.close);
      this.input.val(content);
    },

    // Toggle the `"done"` state of the model.
    toggleDone: function() {
      this.model.toggle();
    },

    // Switch this view into `"editing"` mode, displaying the input field.
    edit: function() {
      $(this.el).addClass("editing");
      this.input.focus();
    },

    // Close the `"editing"` mode, saving changes to the tweet.
    close: function() {
      this.model.save({content: this.input.val()});
      $(this.el).removeClass("editing");
    },

    // If you hit `enter`, we're through editing the item.
    updateOnEnter: function(e) {
      if (e.keyCode == 13) this.close();
    },

    // Remove this view from the DOM.
    remove: function() {
      $(this.el).remove();
    },

    // Remove the item, destroy the model.
    clear: function() {
      this.model.clear();
    }

  });

  // The Application
  // -------------------------------------------------------------------------------------------------------------------

  // Our overall **AppView** is the top-level piece of UI.
  window.AppView = Backbone.View.extend({

    // Instead of generating a new element, bind to the existing skeleton of
    // the App already present in the HTML.
    el: $("#tweetsapp"),

    // Our template for the line of statistics at the bottom of the app.
    statsTemplate: _.template($('#stats-template').html()),

    // Delegated events for creating new items, and clearing completed ones.
    events: {
      "fetched tweets": "createOnEnter",
      "keypress #new-tweet":  "createOnEnter"
    },

    // At initialization we bind to the relevant events on the `Countdowns`
    // collection, when items are added or changed. Kick things off by
    // loading any preexisting tweets that might be saved in *localStorage*.
    initialize: function() {
      _.bindAll(this, 'addOne', 'addAll', 'render');

      this.input    = this.$("#new-tweet");

      Countdowns.bind('add',     this.addOne);
      Countdowns.bind('refresh', this.addAll);
      Countdowns.bind('all',     this.render);

      Countdowns.fetch();
    },

    // Re-rendering the App just means refreshing the statistics -- the rest
    // of the app doesn't change.
    render: function() {
      var done = Countdowns.done().length;
      this.$('#tweet-stats').html(this.statsTemplate({
        total:      Countdowns.length,
        done:       Countdowns.done().length,
        remaining:  Countdowns.remaining().length
      }));
    },

    // Add a single tweet item to the list by creating a view for it, and
    // appending its element to the `<ul>`.
    addOne: function(tweet) {
      var view = new CountdownView({model: tweet});
      this.$("#tweet-list").append(view.render().el);
    },

    // Add all items in the **Countdowns** collection at once.
    addAll: function() {
      Countdowns.each(this.addOne);
    },

    // Generate the attributes for a new Countdown item.
    newAttributes: function() {
      return {
        content: this.input.val(),
        order:   Countdowns.nextOrder(),
        done:    false
      };
    },

    // If you hit return in the main input field, create new **Countdown** model,
    // persisting it to *localStorage*.
    createOnEnter: function(e) {
      if (e.keyCode != 13) return;
      Countdowns.create(this.newAttributes());
      this.input.val('');
    }

  });

  // Finally, we kick things off by creating the **App**.
  window.App = new AppView;

});