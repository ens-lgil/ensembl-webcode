// $Revision$

Ensembl.Panel.FuncgenMatrix = Ensembl.Panel.ModalContent.extend({
  constructor: function (id, params) {
    this.base(id, params);
    
    Ensembl.EventManager.register('mouseUp',             this, this.dragStop);
    Ensembl.EventManager.register('updateConfiguration', this, this.updateConfiguration);
  },
  
  init: function () {
    var panel = this;
    
    this.base();
    
    this.startCell  = [];
    this.dragCell   = [];
    this.viewConfig = {};
    
    this.elLk.tables = $('table.funcgen_matrix', this.el).each(function () {
      var table       = this;   
      var searchTerms = {};
      var disallowed  = { option: 1, disabled: 1, on: 1, filter: 1 };
      var i           = this.rows.length;
      var j, k, classes;
      
      while (i--) {
        j = this.rows[i].cells.length;
        
        while (j--) {
          classes = this.rows[i].cells[j].className.toLowerCase().split(' ');
          k = classes.length;
          
          while (k--) {
            if (classes[k] && !disallowed[classes[k]]) {
              if (!searchTerms[classes[k]]) {
                searchTerms[classes[k]] = [];
              }
              
              searchTerms[classes[k]].push([j, i]);
            }
          }
        }
      }
      
      $(this).data('searchTerms', searchTerms);
      
      table = null;
    });
    
    $('input.filter', this.el).each(function () {
      var related = $(this).parent().siblings();
      
      $(this).data('table',     related.filter('.funcgen_matrix'));
      $(this).data('noResults', related.filter('.no_results'));
      
      related = null;
    }).bind({
      keyup: function () {
        var el = this;
        
        if (this.value && this.value.length < 2) {
          this.lastQuery = this.value;
        }
        
        if (this.value !== this.lastQuery) {
          if (this.searchTimer) {
            clearTimeout(this.searchTimer);
          }
          
          this.searchTimer = setTimeout(function () {
            panel.filter(el);
            el = null;
          }, 250);
        }
      },
      focus: function () {
        this.value = '';
        this.style.color = '#000';
      },
      blur: function () {
        if (!this.value) {
          this.value = 'Filter';
          this.style.color = '#999';
        }
      }
    });
    
    if (!$('body').hasClass('ie')) { // IE 8 and below are too slow
      this.elLk.tables.bind('mousedown', function (e) {
        // only for left clicks, create a highlight overlay to show which cells are being dragged over
        if ((!e.which || e.which === 1) && (e.target.nodeName === 'TD' || e.target.nodeName === 'P')) {
          panel.dragTable = $(this);
          panel.dragStart(e);
        }
        
        return false;
      });
    }
    
    this.elLk.options = $('.option', this.elLk.tables).each(function () {
      this.configCode = 'opt_cft_' + this.title; // configCode is used to set the correct values for the ViewConfig
      panel.viewConfig[this.configCode] = $(this).hasClass('on') ? 'on' : 'off';
    }).bind('click', function () {
      panel.resetSelectAll($(this).toggleClass('on'));
    });
    
    // Display a select all popup for columns
    $('thead th:not(.disabled)', this.elLk.tables).hover(function () {
      if (panel.mousemove) {
        return;
      }
      
      panel.selectAllCol($(this).children('div').show());
    }, function () {
      $(this).children('div').hide();
    }).find('.select_all_column input').bind('click', function () {
      var cls   = this.className;
      var cells = $(this).parents('table').find('.' + this.name);
      
      switch (cls) {
        case ''     : break;
        case 'none' : cells.removeClass('on'); break;
        case 'all'  : cells.addClass('on'); break;
        default     : cells.filter('.' + cls).addClass('on').end().not('.' + cls).removeClass('on');
      }
      
      panel.resetSelectAll(cells);
      
      cells = null;
    });
    
    // Display a select all popup for rows
    $('tbody th', this.elLk.tables).hover(function () {
      if (panel.mousemove) {
        return;
      }
    
      var popup = $(this).children().show();
      
      if (!popup.data('selectAll')) {
        popup.children('input').attr('checked', panel.allOnRow(this));
        popup.data('selectAll', true);
      }
      
      popup = null;
    }, function () {
      $(this).children().hide();
    }).children('.select_all_row').bind('click', function () {
      var input   = $('input', this);
      var checked = panel.allOnRow(this.parentNode);
      
      panel.resetSelectAll($(this).parent().siblings()[checked ? 'removeClass' : 'addClass']('on'));
      
      input.attr('checked', !checked);
      input = null;
    });
  },
  
  allOnRow: function (el) {
    var tds  = $(el).siblings(':not(.disabled)');
    var rtn  = tds.length === tds.filter('.on').length;
    tds = el = null;
    return rtn;
  },
  
  selectAllCol: function (el) {
    if (el.data('selectAll')) {
      return;
    }
    
    var radio = el.find('input');
    var tds   = $(radio[0]).parents('table').find('.' + radio[0].name);
    var on    = tds.filter('.on');
    var checked, i, cls, filtered;
    
    if (tds.length === tds.filter('.default').length) {
      checked = '.default'; // Prioritize the Default option
    } else if (!on.length) {
      checked = '.none';
    } else if (tds.length === on.length) {
      checked = '.all';
    }
    
    if (checked) {
      radio.filter(checked).attr('checked', 'checked');
    } else {
      checked = radio.filter(':checked');
      radio   = radio.not('.all, .none');
      i       = radio.length;
      
      while (i--) {
        cls      = radio[i].className;
        filtered = tds.filter('.' + cls);
        
        if (filtered.length === on.length && filtered.length === on.filter('.' + cls).length) {
          radio[i].checked = 'checked';
          break;
        }
      }
      
      if (i === -1) {
        checked.attr('checked', false); // Deselect all options if nothing matches
      }
      
      checked = null;
    }
    
    el.data('selectAll', true);
    
    el = radio = tds = null;
  },
  
  // Sets the selectAll state of relevant column and row headers to false,
  // so they will be recalculated the next time the th mouseover is triggered.
  resetSelectAll: function (cells) {
    var reset = { row: {}, col: {} };
    var table = cells.parents('table');
    var i;
    
    cells.each(function () {
      reset.row[$(this).parent().index() + 1] = 1;
      reset.col[$(this).index()] = 1;
    });  
    
    for (i in reset.row) {
      $('th .select_all_row', table[0].rows[i]).data('selectAll', false);
    }
    
    for (i in reset.col) {
      $('thead th:eq(' + i + ') .select_all_column ', table).data('selectAll', false);
    }
    
    cells = table = null;
  },
  
  // Called by triggerSpecific from the parent Configurator panel.
  // Does not cause an AJAX request, just returns the diff data.
  updateConfiguration: function () {
    var panel  = this;
    var config = {};
    var diff   = false;
    var on;
    
    this.elLk.options.each(function () {
      on = $(this).hasClass('on') ? 'on' : 'off';
      
      if (panel.viewConfig[this.configCode] !== on) {
        config[this.configCode] = on;
        diff = true;
      }
    });
    
    if (diff) {
      $.extend(true, this.viewConfig, config);
      return config;
    }
  },
    
  dragStart: function (e) {
    var panel  = this;
    var target = $(e.target);
    
    // Cache the mousemove event for easy unbinding
    this.mousemove = function (e2) {
      panel.drag(e2);
      return false;
    };
    
    this.startCell = [ target.index(), target.parent().index() + 1 ]; // cell and row coordinates
    this.dragTable.bind('mousemove', this.mousemove);
    
    target = null;
  },
  
  dragStop: function () {
    if (!this.mousemove) {
      return;
    }
    
    this.resetSelectAll($('.highlight', this.dragTable).removeClass('highlight').not('.disabled').toggleClass('on'));
    this.dragTable.unbind('mousemove', this.mousemove);
    this.mousemove = false;
    this.dragTable = null;
  },
  
  drag: function (e) {
    var target = e.target.nodeName === 'P' ? $(e.target.parentNode) : $(e.target);    
    
    if (target[0].nodeName !== 'TD') {
      target = null;
      return;
    }
    
    var cell = [ target.index(), target.parent().index() + 1 ];
    
    if (cell[0] === this.dragCell[0] && cell[1] === this.dragCell[1]) {
      return; // Target is unchanged
    }
    
    var x     = [ cell[0], this.startCell[0] ].sort(function (a, b) { return a - b; });
    var y     = [ cell[1], this.startCell[1] ].sort(function (a, b) { return a - b; });
    var cells = [];
    var i, j;
    
    for (i = y[0]; i <= y[1]; i++) {
      if (this.dragTable[0].rows[i].style.display !== 'none') {
        for (j = x[0]; j <= x[1]; j++) {
          cells.push(this.dragTable[0].rows[i].cells[j]); // Get the cells in the rows and columns between the current target and the start cell
        }
      }
    }
    
    $('.highlight', this.dragTable).not(cells).removeClass('highlight');
    $(cells).not('.highlight').addClass('highlight');
    
    this.dragCell = cell;
    
    target = cells = null;
  },
  
  filter: function (el) {
    var table       = $(el).data('table');
    var noResults   = $(el).data('noResults').hide();
    var searchTerms = table.data('searchTerms');
    var value       = el.value.toLowerCase();
    var matches     = { row: {}, col: {}, cells: [] };
    var rows        = [];
    var cells       = [];
    var i, j;
    
    if (value) {
      for (i in searchTerms) {
        if (i.indexOf(value) !== -1) {
          for (j in searchTerms[i]) {
            matches.cells.push(searchTerms[i][j]);
            matches.col[searchTerms[i][j][0]] = 1;
            matches.row[searchTerms[i][j][1]] = 1;
          }
        }
      }
      
      if (matches.cells.length) {
        for (i in matches.row) {
          rows.push(table[0].rows[i]);
        }
        
        for (i in matches.cells) {
          cells.push(table[0].rows[matches.cells[i][1]].cells[matches.cells[i][0]]);
        }
      
        table.find('tbody tr').not(rows).hide();
        table.find('.filter').removeClass('filter');
        $(rows).show();
        $(cells).addClass('filter');
      } else {
        table.find('tbody tr').hide();
        noResults.show();
      }
    } else {
      table.find('tbody tr').show().children('.filter').removeClass('filter');
    }
    
    table = noResults = cells = rows = null;
  }
});
