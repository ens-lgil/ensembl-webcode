/*
 * Copyright [1999-2015] Wellcome Trust Sanger Institute and the EMBL-European Bioinformatics Institute
 * Copyright [2016-2017] EMBL-European Bioinformatics Institute
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

Ensembl.Panel.PDB = Ensembl.Panel.Content.extend({
  init: function() {
    console.log('init PDB');
    var panel = this;
    this.base.apply(this, arguments);

//    $.getScript('http://www.ebi.ac.uk/~lgil/tests/3d/popup/litemol-custom-theme.js');
    //this.elLk.target = this.el.append('<div id="pdb">');

    this.species = 'Homo_sapiens';    

    this.rest_url_root    = 'https://rest.ensembl.org/';
    this.rest_var_url     = this.rest_url_root+'variation/'+this.species+'/';
    this.rest_overlap_url = this.rest_url_root+'overlap/region/'+this.species+'/';
    this.rest_pr_url      = this.rest_url_root+'overlap/translation/';
    this.rest_lookup_url  = this.rest_url_root+'lookup/id/';
    this.rest_pdbe_url    = 'https://www.ebi.ac.uk/pdbe/api/pdb/entry/molecules/';

    
    this.protein_sources = { 
                             'Pfam'   : 'http://pfam.xfam.org/family/',
                             'PRINTS' : 'https://www.ebi.ac.uk/interpro/signature/',
                             'Gene3D' : 'http://gene3d.biochem.ucl.ac.uk/Gene3D/search?mode=protein&sterm='
                           };


    this.hexa_to_rgb = { 
                         'red'        : {r:255, g:0,   b:0},
                         'blue'       : {r:0,   g:0,   b:250},
                         'green'      : {r:0,   g:128, b:0},
                         'orange'     : {r:255, g:165, b:0},
                         'white'      : {r:255, g:255, b:255},
                         'maroon'     : {r:128, g:0,   b:0},
                         'light_grey' : {r:200, g:200, b:200},
                         'dark_grey'  : {r:100, g:100, b:100},
                         'darkred'    : {r:55,  g:0,   b:0},
                         '#DDD'       : {r:221, g:221, b:221}
                       };

    this.liteMolScope;
    
    this.var_id;
    this.var_cons;
    this.ensp_id;

    this.ensp_pdb_list = {};
    this.ensp_var_pos  = {};
    this.ensp_length   = {};

    this.failed_get_ensp_length = {};

    this.mapping_min_percent = 50
    this.mapping_min_length  = 10;

    this.pdb_id;
    this.pdb_start;
    this.pdb_end;
    this.pdb_hit_start;
    this.pdb_struct_asym;
    this.pdb_chain_struc_entity = new Object();

    this.details_header = '<th>ID</th><th class="location _ht" title="Position in the selected PDB model"><span>PDB</span></th><th class="location _ht" title="Position in the selected Ensembl protein"><span>ENSP</span></th>';


    //$.getScript('/pdbe/angular.1.4.7.min.js');//, function () {
    //$.getScript('/pdbe/pdb.component.library.min-1.0.0.js');//, function () {
/*   $.getScript('/pdbe/litemol-custom-theme.js')
      .done(function( s, Status ) { 
        console.log("Litemol plugin file Loaded"); 
      })
      .fail(function( jqxhr, settings, exception ) {
        console.log( "Triggered ajaxError handler: "+settings+" | "+exception );
      });*/
    panel.addSpinner();


    $(document).ready(function () {
      console.log('doc ready');
      
      panel.addSpinner(); 

      // Transcript portal
      if ($("#ensp_id").length) {
        panel.ensp_id = $("#ensp_id").html();
        panel.get_ens_protein_length(panel.ensp_id);
        panel.get_pdb_list(panel.ensp_id,1);
      }
      // Variation portal
      else {
        panel.get_var_data();

        $('#ensp_list').change(function () {
          panel.ensp_id = $(this).val();
          if (panel.ensp_id && panel.ensp_id != '-') {
            $(".var_pos").html(panel.ensp_var_pos[panel.ensp_id]);
            $("#var_ensp_id").html(panel.ensp_id);
            $("#variant_pos_info").show();
            panel.display_pdb_list(panel.ensp_id);
          }
          else {
            $(".var_pos").html('');
            $("#var_ensp_id").html('');
            $("#variant_pos_info").hide();
          }
        });
      }  

      // Select a PDBe model
      $('#pdb_list').change(function () {
        var pdb_id = $(this).val();
        panel.selectPDBEntry(pdb_id);
//console.log("LiteMol DATA: "+panel.liteMolScope.LiteMolComponent.plugin.context.select('model')[0]);
      });

      // Select a group of features to highlight
      $(document).on('click', '.pdb_feature_group', function() {
        $(this).toggleClass('view_enabled view_disabled');
        panel.selectedFeatureGroupsToHighlight($(this).attr('id'));
      });

      // Select a subgroup of features to highlight
      $(document).on('click', '.pdb_feature_subgroup', function() {
        $(this).toggleClass('view_enabled view_disabled');
        panel.selectedFeatureSubGroupsToHighlight($(this).attr('id'));
      });
      
      // Select a feature (or a list of features) to highlight
      $(document).on('click', '.pdb_feature_entry', function() {
        $(this).toggleClass('view_enabled view_disabled');
        panel.selectedFeaturesToHighlight();
      });
      
      // Expans/collapse a list of features
      $(document).on('click', '.view_toggle', function() {
        var div_id = '#'+$(this).attr('rel')+'_div';
        if ($(this).hasClass('closed')) {
          $(div_id).show();
        }
        else {
          $(div_id).hide();
        }
        $(this).toggleClass('open closed');
      });

      // Reset the viewer
      $(document).on('click', '.viewer_reset_btn', function() {
        $('.view_spinner').show();
        // Needed to show the spinner
        setTimeout(function(){ 
          // Reset right hand menu
          panel.setDefaultHighlighting();
          // Reset to default view (like the "Reset" button in the viewer
          panel.liteMolScope.LiteMolComponent.Bootstrap.Command.Visual.ResetScene.dispatch(panel.liteMolScope.LiteMolComponent.plugin.context, void 0);
          // Reset to default highlighting
          panel.selectedFeatureGroupsToHighlight();
          $('.view_spinner').hide();
        }, 20);
      });
    });
  },


  setDefaultHighlighting: function() {
    var panel = this;
    
    $('.view_enabled').switchClass('view_enabled','view_disabled');
    /*$.each(['.pdb_feature_group', '.pdb_feature_subgroup', '.pdb_feature_entry'], function(i,classname) {
      $(classname).switchClass('view_enabled','view_disabled');
    });*/

    // Check default options
    $('#mapping_group').switchClass('view_disabled','view_enabled');
    if (panel.var_id) {
      $('#variant_group').switchClass('view_disabled','view_enabled');
    }
  }, 
 
  selectPDBEntry: function(pdb_id) {
    var panel = this;

    panel.setDefaultHighlighting();

    if (pdb_id && pdb_id != '-') {
      var sel = $('#pdb_list').find('option:selected');
      panel.pdb_id        = pdb_id;
      panel.pdb_start     = Number(sel.attr('data-start'));
      panel.pdb_end       = Number(sel.attr('data-end'));
      panel.pdb_chains    = sel.attr('data-chain').split(',');
      panel.pdb_hit_start = Number(sel.attr('data-hit-start'));
      console.log("PDB coords of "+pdb_id+" (on ENSP): "+panel.pdb_start+'-'+panel.pdb_end);

      $('#mapping_ensp').html('<a href="/'+panel.species+'/Transcript/Summary?t='+panel.ensp_id+'" style="color:white">'+panel.ensp_id+'</a>');
      $('#mapping_pdb').html('<a href="https://www.ebi.ac.uk/pdbe/entry/pdb/'+pdb_id+'" rel="external" style="color:white">'+pdb_id.toUpperCase()+'</a>');


      // Assign position to variant
      if (panel.var_id) {
        var var_pos_ensp = panel.ensp_var_pos[panel.ensp_id].split('-');
        var var_pdb_coords = panel.ensp_to_pdb_coords(var_pos_ensp[0],var_pos_ensp[1]);

        $('#'+panel.var_id+'_cb').attr('data-value', var_pdb_coords[0]+','+var_pdb_coords[1]);

        // Special display for the stop_gained variants
        if (panel.var_cons && (panel.var_cons == 'stop_gained' || panel.var_cons == 'frameshift_variant')) {
          var var_pos_after_stop =  Number(var_pos_ensp[1]) + 1;

          var altered_sequence = '<tr><td style="border-color:darkred">Altered/missing sequence</td>'+
            '<td>from '+var_pdb_coords[0]+'</td><td>from '+var_pos_ensp[1]+'</td>'+
            '<td><span class="pdb_feature_entry float_left view_enabled" id="'+panel.var_id+'_alt_cb" data-value="'+var_pos_after_stop+','+panel.pdb_end+'" data-group="variant_group" data-na     me="'+panel.var_id+'_alt" data-colour="darkred"></span></td></tr>';
        
          $('#var_details_div > table > tbody').append(altered_sequence);
        }

        var var_pos_pdb = (var_pdb_coords[0] == var_pdb_coords[1]) ? var_pdb_coords[0] : var_pdb_coords[0]+'-'+var_pdb_coords[1];
        $('#var_pos_pdb').html(var_pos_pdb);
        var_pos_ensp = (var_pos_ensp[0] == var_pos_ensp[1]) ? var_pos_ensp[0] : var_pos_ensp[0]+'-'+var_pos_ensp[1];
        $('#var_pos_ensp').html(var_pos_ensp);
      }

      // Assign position to ENSP mapping
      var ensp_pdb_coords = panel.ensp_to_pdb_coords(panel.pdb_start, panel.pdb_end);
      $('#mapping_cb').attr('data-value', ensp_pdb_coords[0]+','+ensp_pdb_coords[1]);

      $('#mapping_ensp_pos').html(panel.pdb_start+'-'+panel.pdb_end);
      $('#mapping_pdb_pos').html(ensp_pdb_coords[0]+'-'+ensp_pdb_coords[1]);

      // Display the LiteMol canvas
      panel.load3DWidget();
   
      $('#litemol_buttons').show();

      // Load the right hand side menu
      if (panel.ensp_id) {
        panel.get_exon_data(panel.ensp_id); // Might need to move it into the #ensp_list change block
        panel.get_protein_feature_data(panel.ensp_id);
        panel.get_sift_polyphen_data(panel.ensp_id);
      }
    }
    else {
      $('#litemol_buttons').hide();
    }
  },


  // Function to load the PDB LiteMol 3D Widget (Angular), with the colouration plugin
  load3DWidget: function() {
    var panel = this;

    panel.removeComponents(); 
  
    var pdb_litemol_id = 'litemol_pdb_model';
  
    var pdb_tag = '<pdb-lite-mol id="'+pdb_litemol_id+'" pdb-id="\''+panel.pdb_id+'\'" hide-controls="true" fogEnabled="false" show-logs="false"></pdb-lite-mol>';
    
    $("#litemol_canvas").html(pdb_tag);

    var componentElements = $('#'+pdb_litemol_id);

    angular.bootstrap(componentElements, ['pdb.component.library']);

    // Method to bind component scope
    var bindPdbComponentScope = function(element){
      return angular.element(element).isolateScope();
    }
    panel.liteMolScope = bindPdbComponentScope($('#'+pdb_litemol_id));

    $.getScript('/pdbe/litemol-custom-theme.js').done(function() {

      // Set interval to check that the model loading is done before highlighting some features by default
      var max_interval_iteration = 30;
      var interval_iteration_count = 0;
      var checkExist = setInterval(function() {
        if (panel.liteMolScope.LiteMolComponent.plugin.context.select('model')[0] != undefined || interval_iteration_count == max_interval_iteration) {
          if (interval_iteration_count == max_interval_iteration) {
            console.log("Model loading takes too long!");
          }
          else {
            console.log("Model loading done! => "+interval_iteration_count);
          }
          var timeout = (panel.var_id) ? 0 : 200;
          setTimeout(function(){ panel.selectedFeatureGroupsToHighlight(); }, timeout);
          clearInterval(checkExist);
          checkExist = 0;
        }
        interval_iteration_count ++;
      }, 100);
    });

  },
 
  // Function to remove any existing component instance
  removeComponents: function() {
    $('#litemol_canvas').empty();
  },

  // Select/unselect a group of entries to highlight
  selectedFeatureGroupsToHighlight: function(id) {
    var panel = this;

    if (!id) {
      id = '_group';
    } 
    $('div[id$='+id+']').each(function() {
      var gp_id = $(this).attr('id');

      var is_selected = $('#'+gp_id).hasClass('view_enabled');
//console.log("GROUP ID: "+gp_id+" => "+is_selected);
      var pdb_feature_entry_array = $('[data-group="'+gp_id+'"]');

      pdb_feature_entry_array.each(function() {
        if (is_selected) {
          $(this).switchClass('view_disabled','view_enabled');
        }
        else {
          $(this).switchClass('view_enabled','view_disabled');
        }
      });
    });

    panel.selectedFeaturesToHighlight();
  },

  // Select/unselect a subgroup of entries to highlight
  selectedFeatureSubGroupsToHighlight: function(id) {
    var panel = this;

    if (!id) {
      id = '_sg';
    }
    $('div[id$='+id+']').each(function() {
      var subgp_id = $(this).attr('id');

      var is_selected = $('#'+subgp_id).hasClass('view_enabled');
      var pdb_feature_entry_array = $('[data-sg="'+subgp_id+'"]');
    
      pdb_feature_entry_array.each(function() {
        if (is_selected) {
          $(this).switchClass('view_disabled','view_enabled');
        }
        else {
          $(this).switchClass('view_enabled','view_disabled');
        }
      });
    });

    panel.selectedFeaturesToHighlight();
  },


  // Select/unselect a list of entries to highlight  
  selectedFeaturesToHighlight: function() {
    var panel = this;

    if (!panel.liteMolScope) {
      return;      
    }

    // Recolour to default colour when no selection
    var coloring_default = {
      base: panel.hexa_to_rgb['dark_grey'],
      entries: []
    };
    
    var model_default = panel.liteMolScope.LiteMolComponent.plugin.context.select('model')[0];
    if (!model_default) {
      return;
    }
    var theme_default = LiteMolPluginInstance.CustomTheme.createTheme(model_default.props.model, coloring_default);
  
    // instead of "polymer-visual", "model" or any valid ref can be used: all "child" visuals will be colored.
    LiteMolPluginInstance.CustomTheme.applyTheme(panel.liteMolScope.LiteMolComponent.plugin, 'polymer-visual', theme_default);

    // List the PDB struct_asyms mapped to the ENSP
    var pdb_chain_ids = ['A'];
    if (panel.pdb_chains && panel.pdb_chain_struc_entity[panel.pdb_id]) {
      pdb_chain_ids = panel.pdb_chains;
    }

    // Move the Variant element at the end of the array, in order to have it display all the time
    var pdb_feature_entry_array = $('.pdb_feature_entry');
    var var_index = '';
    pdb_feature_entry_array.each(function(index, el) {
      if (el.classList.contains('pdb_var_entry')) {
        var_index = index;
        return true;
      }
    });
    if (var_index != '') {
     var pdb_var_entry = pdb_feature_entry_array.splice(var_index, 1);
      pdb_feature_entry_array.push(pdb_var_entry[0]);
    }

    // Loop over the right hand menu to see what has been selected in order to highlight it
    var residueToHighlight = panel.features2LiteMol(pdb_feature_entry_array, pdb_chain_ids);
    var residueDetails = residueToHighlight[0];
    var specialResidueDetails = residueToHighlight[1];

    console.log("# selectedFeaturesToHighlight => residueDetails: "+residueDetails.length+" | specialResidueDetails: "+specialResidueDetails.length);

    // Implementation from LiteMol core example
    var model = panel.liteMolScope.LiteMolComponent.plugin.context.select('model')[0];
    if (!model) {
      return;
    }

    var coloring = {
      base: panel.hexa_to_rgb['dark_grey'],
      entries: residueDetails
    };

    var theme = LiteMolPluginInstance.CustomTheme.createTheme(model.props.model, coloring);

    // Special highlight
    if (specialResidueDetails.length > 0) {
      var action = panel.liteMolScope.LiteMolComponent.Transform.build();
 
      for(var si=0, sl=specialResidueDetails.length; si<sl; si++ ){
        var query = panel.liteMolScope.LiteMolComponent.Query.sequence(
                        specialResidueDetails[si].entity_id.toString(),
                        specialResidueDetails[si].struct_asym_id.toString(),
                        { seqNumber: specialResidueDetails[si].start_residue_number }, 
                        { seqNumber: specialResidueDetails[si].end_residue_number }
                    );
        if (specialResidueDetails[si].checked) {
          action.add(model, panel.liteMolScope.LiteMolComponent.Transformer.Molecule.CreateSelectionFromQuery, { query: query, name: 'Selection-'+si }, { ref: 'sequence-selection-'+si })
          .then(panel.liteMolScope.LiteMolComponent.Transformer.Molecule.CreateVisual, { style: panel.liteMolScope.LiteMolComponent.Visualization.Molecule.Default.ForType.get('BallsAndSticks') }); //BallsAndSticks | Surface
        }
      }
   
      panel.liteMolScope.LiteMolComponent.applyTransforms(action).then(function(){
        // instead of "polymer-visual", "model" or any valid ref can be used: all "child" visuals will be colored.
        LiteMolPluginInstance.CustomTheme.applyTheme(panel.liteMolScope.LiteMolComponent.plugin, 'polymer-visual', theme);
      });
    }
    else if (residueDetails.length > 0) {
      // instead of "polymer-visual", "model" or any valid ref can be used: all "child" visuals will be colored.
      LiteMolPluginInstance.CustomTheme.applyTheme(panel.liteMolScope.LiteMolComponent.plugin, 'polymer-visual', theme);
    }
  },
  
  features2LiteMol: function(pdb_feature_entry_array, pdb_chain_ids) {
    var panel = this;
    var residueDetails = [];
    var specialResidueDetails = [];
    var featureGroups = {};   

    pdb_feature_entry_array.each(function(index, el) {

      // Check whether all the group entries have been checked or not
      // Then it check or uncheck the "Group" checkbox
      var group_id = el.getAttribute('data-group');
      var is_enabled = $(this).hasClass('view_enabled');
      if (!featureGroups[group_id]) {
        var pdb_feature_entry_array = $('[data-group="'+group_id+'"]');
        var count_checked = 0;
        pdb_feature_entry_array.each(function() {
          if ($(this).hasClass('view_enabled')) {
            count_checked++;
          }
        });
        if (count_checked == pdb_feature_entry_array.length) {
          $('#'+group_id).switchClass('view_disabled','view_enabled');
          if ($("#"+group_id+"[data-has-sg]").length) {
            $('[data-super-group="'+group_id+'"]').switchClass('view_disabled','view_enabled');
          }
        }
        else {
          $('#'+group_id).switchClass('view_enabled','view_disabled');
          if ($("#"+group_id+"[data-has-sg]").length && count_checked == 0) {
            $('[data-super-group="'+group_id+'"]').switchClass('view_enabled','view_disabled');
          }
        }
        featureGroups[group_id] = 1;
      }

      var special_hl = el.getAttribute('data-highlight');

      // Check if entry is checked
      if (is_enabled || special_hl) {  
        var data_colours = el.getAttribute('data-colour');
        var var_colours  = data_colours.split(';');
        var data_value   = el.getAttribute('data-value');
        
        var pos_list = data_value.split(';');
//console.log(">> FEATURE "+el.id+" | "+data_colours+" | "+data_value);
        $.each(pos_list, function(index, se_pos) {

          var pos = se_pos.split(',');

          // Colour the AA 1 by 1 because of some gaps in the 3D models messing up the colouration of a range of sequence.
          for (var i = Number(pos[0]); i <= Number(pos[1]); i++) {
 
            var start_residue = i;
            var end_residue   = i;

            var var_colour;
            if (var_colours.length > 1) {
              if (var_colours[index]) {
                var_colour = var_colours[index];
              }
              else if (panel.isOdd(index)) {
                var_colour = var_colours[1];
              }
              else {
                var_colour = var_colours[0];
              }
            }
            else {
              var_colour = var_colours[0];
            }
//console.log("VALUE: "+start_residue+" | "+var_colour);
            for (var j = 0; j < pdb_chain_ids.length; j++) {
              var chain = pdb_chain_ids[j];
              var struct_asym = chain; 
              var entity = 1;
              if (panel.pdb_chain_struc_entity[panel.pdb_id] && panel.pdb_chain_struc_entity[panel.pdb_id][chain]) {
                entity      = panel.pdb_chain_struc_entity[panel.pdb_id][chain]['entity_id'];
                struct_asym = panel.pdb_chain_struc_entity[panel.pdb_id][chain]['struct_asym_id'];
              }
//console.log(panel.pdb_id+" CHAIN - STRUCT - ENTITY: "+chain+" | "+struct_asym+" | "+entity);  
              var selectionDetails = {
                                       entity_id : entity, 
                                       struct_asym_id : struct_asym,
                                       start_residue_number : start_residue, 
                                       end_residue_number : end_residue,
                                       color: panel.hexa_to_rgb[var_colour],
                                       checked: is_enabled
                                     };
              if (is_enabled) {
                residueDetails.push(selectionDetails);
              }
              // Special highlighting with side chaine
              if (typeof special_hl !== typeof undefined && special_hl !== false && special_hl !== null) {
                var hl_list = special_hl.split(';');
                if (hl_list[index] == 1) {
                  specialResidueDetails.push(selectionDetails);
                }
              }

            }
          }
        });
      }
    });
    return [residueDetails,specialResidueDetails];
  },
  
 
  ///// PDB data /////

  get_pdb_list: function(ensp,display) {
    var panel = this;
    $('#pdb_list_label').hide();
    $('#pdb_list').hide(); 
    $('#right_form').addClass('loader_small');

    // Transcript
    if ($("#ensp_id").length) {
      panel.get_pdb_by_ensp(ensp,display);
    }
    // Variant
    else {
      var var_pr_pos = 0;
  
      $.ajax({
        url: panel.rest_pr_url+ensp+'?feature=transcript_variation;type='+panel.var_cons,
        method: "GET",
        contentType: "application/json; charset=utf-8",
        success: function (data) {
          panel.parse_tv_results(data,ensp);
          panel.get_pdb_by_ensp(ensp,display);
        },
        error: function (xhRequest, ErrorText, thrownError) {
          console.log('ErrorText: ' + ErrorText + "\n");
          console.log('thrownError: ' + thrownError + "\n");
        }
      });
      console.log("Variant Pr coord");
    }
  },

  get_pdb_by_ensp: function(ensp,display) {
    var panel = this;

    $.ajax({
      url: panel.rest_pr_url+ensp+'?feature=protein_feature&type=',
      method: "GET",
      contentType: "application/json; charset=utf-8",
      success: function (data) {
        panel.get_pdb_chain_struc_entity(data); 
        panel.parse_pdb_results(data,ensp,display);
      },
      error: function (xhRequest, ErrorText, thrownError) {
        console.log('ErrorText: ' + ErrorText + "\n");
        console.log('thrownError: ' + thrownError + "\n");
      }
    });
    console.log("PDB list"); 
  },

  get_pdb_chain_struc_entity: function(data) {
    var panel = this;
    
    var pdb_list = [];
    $.each(data,function (index, result) {
      var pdb_acc = result.id.split('.');
      var pdb_id = pdb_acc[0];
      if (jQuery.inArray(pdb_id,pdb_list) == -1) {
        pdb_list.push(pdb_id);
        
        $.ajax({
          url: panel.rest_pdbe_url+pdb_id,
          method: "GET",
          //dataType: 'jsonp',
          //contentType: "application/json; charset=utf-8",
          contentType: 'text/plain',
          success: function (pdb_data) {
            $.each(pdb_data[pdb_id],function (i, pdb_result) {
//console.log(">> "+pdb_id+": entity "+pdb_result.entity_id+" | molecule type "+pdb_result.molecule_type);
              if (pdb_result.molecule_type!='polypeptide(L)') {
                return true;
              }
              var entity = pdb_result.entity_id;
              if (entity) {
                $.each(pdb_result.in_chains,function (j, chain) {
                  var struct_asym = pdb_result.in_struct_asyms[0];
                  if (pdb_result.in_struct_asyms[j] && j != 0) {
                    struct_asym = pdb_result.in_struct_asyms[j];
                  }
                  
                //$.each(pdb_result.in_struct_asyms,function (j, struct_asym) {
                  if (!panel.pdb_chain_struc_entity[pdb_id]) { 
                    panel.pdb_chain_struc_entity[pdb_id] = {};
                  }
                  panel.pdb_chain_struc_entity[pdb_id][chain] = { 'struct_asym_id': struct_asym, 'entity_id': entity};

//console.log("CE - "+pdb_id+": Entity => "+entity+" | Chain => "+chain+" | Struct asym => "+struct_asym+" | Array: "+panel.pdb_chain_struc_entity[pdb_id][chain] );
                });
              }              
            });     
          },
          error: function (xhRequest, ErrorText, thrownError) {
            console.log('ErrorText: ' + ErrorText + "\n");
            console.log('thrownError: ' + thrownError + "\n");
          }

        });
        console.log("Get struct_asym - entity");          
      } 
    });
  },
  
  parse_pdb_results: function(data,ensp,display) {
    var panel = this;

    panel.removeSpinner();

    if (data.error) {
       $('#ensp_pdb').html("Error: we can't retrieve the list of PDB models for this protein!"); 
    }
    else if (data.length == 0) {
      panel.showNoData();
    }
    else {
//console.log("DATA: |"+data+'|');
      var pdb_list   = [];
      var pdb_objs   = [];
      var pdb_struct_asyms = new Object();

      var var_pos = panel.ensp_var_pos[ensp];      

      $.each(data,function (index, result) {
        var pdb_acc = result.id.split('.');
        var pdb_id = pdb_acc[0];
        var pdb_struct_asym = pdb_acc[1];
        if (pdb_struct_asyms[pdb_id] && jQuery.inArray(pdb_struct_asym,pdb_struct_asyms[pdb_id]) == -1) { 
          pdb_struct_asyms[pdb_id].push(pdb_struct_asym);
        }
        else {
          pdb_struct_asyms[pdb_id] = [pdb_struct_asym];
        }
      });

      $.each(data,function (index, result) {
        var pdb_acc = result.id.split('.');
        var pdb_id = pdb_acc[0];
        //var pdb_struct_asym = pdb_acc[1];
        if (jQuery.inArray(pdb_id,pdb_list) == -1) {
          var var_in_pdb = 0;
          if (var_pos) {
            var var_pos_list = var_pos.split('-');
            if (var_pos_list[0] >= result.start && var_pos_list[1] <= result.end) {
              var_in_pdb = 1;
            }
          }
          if ((var_pos && var_in_pdb == 1) || !var_pos) {
            var pdb_size = result.end - result.start + 1;
            var chains = pdb_struct_asyms[pdb_id].sort();
            pdb_objs.push({id: pdb_id, start: result.start, end: result.end, chain: chains, size: pdb_size, hit_start: result.hit_start, hit_end: result.hit_end});
//console.log(pdb_id+": "+result.start+"-"+result.end+" (struct_asym "+chains+")");
            pdb_list.push(pdb_id);
          }
        }
      });

      if (pdb_objs && pdb_objs.length != 0) {

        panel.ensp_pdb_list[ensp] = pdb_objs;

        if (Object.keys(panel.ensp_pdb_list).length > 1) {
          if (display) {
            $('#ensp_list').prepend($('<option>', {
              value: '-',
              text : '-'
            }));  
          }
        }

        if (display) {
          $('#ensp_list').append($('<option>', {
             value: ensp,
             text : ensp,
             selected: 'selected'
          }));
     
          panel.display_pdb_list(ensp);
        }
      }
    }

  },
  // Display the dropdown selector for the PDB models
  display_pdb_list: function(ensp) {
    var panel = this;

    panel.removeSpinner();

    if (jQuery.isEmptyObject(panel.ensp_pdb_list) || !panel.ensp_pdb_list[ensp]) {
      panel.showNoData();
    }
    else {
      if ($('.var_pos').length) {
        $('.var_pos').html(panel.ensp_var_pos[ensp]);
        $("#var_ensp_id").html(ensp);
      }
      var pdb_objs = panel.ensp_pdb_list[ensp];
      pdb_objs.sort(function(a,b) {
        return b.size - a.size;
      });
      $('#right_form').removeClass('loader_small');
      $('#pdb_list_label').hide();
      $('#pdb_list').hide();
      $('#pdb_list').html('');

      var selected_pdb = '';
      var show_pdb_list = 0;
      var first_pdb_entry = 1;

      var pdb_list_length = pdb_objs.length;
      /*if (pdb_list_length != 1) {
        $('#pdb_list').append($('<option>', { value: '-',  text : '-' }));
      }*/

      // Makes sure the length of the ENSP is returned before populating the list of PDBe entries
      // The Ensembl REST call is made at the beginning of the script
      var counter = 0;
      var i_length = setInterval(function(){
        counter++;
        if(counter === 20 || panel.ensp_length[ensp] != undefined || panel.failed_get_ensp_length[ensp] != undefined) {

          $.each(pdb_objs, function (i, pdb_obj) {
            var pdb_mapping_length = pdb_obj.end - pdb_obj.start + 1;
            var ensp_pdb_percent  = (pdb_mapping_length/panel.ensp_length[ensp])*100;
            var ensp_pdb_coverage = Math.round(ensp_pdb_percent);

//console.log("- "+pdb_obj.id+": "+ensp_pdb_coverage+" | "+pdb_mapping_length+" | "+panel.ensp_length[ensp]);
            if (panel.mapping_min_percent <= ensp_pdb_coverage && panel.mapping_min_length <= pdb_mapping_length) {
              var pdb_coord = " - Coverage: [ PDBe: "+pdb_obj.hit_start+'-'+pdb_obj.hit_end+" | ENSP: "+pdb_obj.start+"-"+pdb_obj.end+" ] => "+ensp_pdb_coverage+"% of ENSP length";

              var pdb_option = {
                     'value'         : pdb_obj.id,
                     'data-start'    : pdb_obj.start,
                     'data-end'      : pdb_obj.end,
                     'data-hit-start': pdb_obj.hit_start,
                     'data-chain'    : pdb_obj.chain,
                     'text'          : pdb_obj.id + pdb_coord
                  };
              if (first_pdb_entry == 1 || pdb_list_length == 1) {
                pdb_option['selected'] = 'selected';
                selected_pdb = pdb_obj.id;
                first_pdb_entry = 0;
              }
              $('#pdb_list').append($('<option>', pdb_option));
              show_pdb_list = 1;
            }
         });

         if (show_pdb_list) {
            $('#pdb_list_label').show();
            $('#pdb_list').show();
            panel.selectPDBEntry(selected_pdb);
          }
          else {
            panel.showNoData();
          } 
          if (counter === 20 && panel.ensp_length[ensp] == undefined) {
            console.log("Fetching ENSP length through the REST API takes too long!");
          }
          clearInterval(i_length);
        }
      }, 100);
    }
    $('#ensp_pdb').show();
  },

  get_all_pdb_list: function(ensp_list) {
    var panel = this;
    $.each(ensp_list, function(i,ensp) {
      panel.get_pdb_list(ensp);
    });

    $( document ).ajaxStop(function() {

      panel.removeSpinner();

      console.log("ENSP count: "+Object.keys(panel.ensp_pdb_list).length+' (get_all_pdb_list)');
      if (!panel.ensp_id) {
        var first_ensp_entry = 1;   

        if (Object.keys(panel.ensp_pdb_list).length != 0) {

          if (Object.keys(panel.ensp_pdb_list).length > 1) {
            var first_ensp_entry = 1;

            $.each(Object.keys(panel.ensp_pdb_list), function(i,ensp) {
              var ensp_list_option = {
                value: ensp,
                text : ensp
              };
              if (first_ensp_entry == 1) {
                ensp_list_option['selected'] = 'selected';
                panel.ensp_id= ensp;
                first_ensp_entry = 0;
              }
              $('#ensp_list').append($('<option>', ensp_list_option));
            });
          }
          else if (Object.keys(panel.ensp_pdb_list).length == 1) {
            $.each(Object.keys(panel.ensp_pdb_list), function(i,ensp) {
              panel.ensp_id = ensp
              $('#ensp_list').append($('<option>', {
                value: ensp,
                text : ensp,
                selected: 'selected'
              }));
              $(".var_pos").html(panel.ensp_var_pos[panel.ensp_id]);
              $("#var_ensp_id").html(panel.ensp_id);
              $("#variant_pos_info").show();
            });
          }
          panel.display_pdb_list(panel.ensp_id);
        }
        else {
          panel.showNoData();
        }
        $('#pdb_msg').removeClass('spinner');
        $("#ensp_pdb").show();
      }
      else {
console.log("panel.ensp_id '"+panel.ensp_id+"' is defined");
      }
    });

  },
  
  
  ///// Ensembl data /////

  // Variant data & Ensembl protein list
  get_var_data: function(var_id) {
    var panel = this;

    var var_id_param = this.getParameterByName("v");
    if (var_id_param) {
      var_id = var_id_param;
    }
    else if ($("#var_id").length) {
      var_id = $("#var_id").html();
    }

    panel.var_id = var_id

    $("#var_id").html(panel.var_id);

    $.ajax({
        url: panel.rest_var_url+panel.var_id,
        method: "GET",
        contentType: "application/json; charset=utf-8",
        success: function (data) {
          // Variant data
          panel.parse_var_results(data);
          
          // Ensembl protein data
          var coords = data.mappings[0].location;
          var chr_start_end = coords.split(':');
          var start_end = chr_start_end[1].split('-');
          if (start_end[0]>start_end[1]) {
            coords=chr_start_end[0]+":"+start_end[1]+"-"+start_end[0];
          }
          panel.get_ens_proteins_list(coords);
        },
        error: function (xhRequest, ErrorText, thrownError) {
          console.log('ErrorText: ' + ErrorText + "\n");
          console.log('thrownError: ' + thrownError + "\n");
        }
    });
    console.log("Variation coordinates and most severe consequence done");
  },

  // Parse results from the Ensembl REST call and display the data
  parse_var_results: function(data) {
    var panel = this;
    if (!data.error) {
      panel.var_cons = data.most_severe_consequence;
      $('#msc_var').html(panel.var_cons);
    }
  },

  get_ens_proteins_list: function(coords) {
    var panel = this;

    $('#right_form').addClass('loader_small');
    $.ajax({
      url: panel.rest_overlap_url+coords+'?feature=cds',
      method: "GET",
      contentType: "application/json; charset=utf-8",
      success: function (data) {
        panel.parse_ens_protein_results(data);
      },
      error: function (xhRequest, ErrorText, thrownError) {
        console.log('ErrorText: ' + ErrorText + "\n");
        console.log('thrownError: ' + thrownError + "\n");
      }
    });
    console.log("Protein list done");
  },

  parse_ens_protein_results: function(data) {
    var panel = this;
    if (!data.error) {
      var prot_list = [];
      $.each(data,function (index, result) {
        var pr = result.protein_id;
        if (jQuery.inArray(pr,prot_list) == -1) {
          prot_list.push(pr);
          panel.get_ens_protein_length(pr);
        }
      });
      prot_list.sort();
    
      $('#right_form').removeClass('loader_small');
      $('#ensp_list').html('');
      $('#pdb_list').html('');
    
      if (prot_list.length == 0) {
        panel.showNoData();
      }
      else if (prot_list.length == 1) {
        var pr_id = prot_list[0];
        panel.ensp_id = pr_id;
        panel.get_pdb_list(pr_id,1);
      }
      else {
        panel.get_all_pdb_list(prot_list);
      }
    }
  },

  get_ens_protein_length: function(ensp) {
    var panel = this;
    $.ajax({
        url: panel.rest_lookup_url+ensp,
        method: "GET",
        contentType: "application/json; charset=utf-8",
        success: function (data) {
          panel.ensp_length[ensp] = data.length;
        },
        error: function (xhRequest, ErrorText, thrownError) {
          console.log('ErrorText: ' + ErrorText + "\n");
          console.log('thrownError: ' + thrownError + "\n");
          panel.failed_get_ensp_length[ensp] = 1;
        }
    });
  },
  
  parse_tv_results: function(data,ensp) {
    var panel = this;
    if (!data.error) {
      $.each(data,function (index, result) {
        if (panel.var_id == result.id) {
          panel.ensp_var_pos[ensp] = result.start+'-'+result.end;
          return true;
        }
      });
    }
  },
  
  
  ///// Get and display Ensembl features /////
  
  get_exon_data: function(ensp_id) {
    var panel = this;

    $.ajax({
        url: panel.rest_pr_url+ensp_id+'?feature=translation_exon',
        method: "GET",
        contentType: "application/json; charset=utf-8",
        success: function (data) {
          panel.parse_exon_results(data);
        },
        error: function (xhRequest, ErrorText, thrownError) {
          console.log('ErrorText: ' + ErrorText + "\n");
          console.log('thrownError: ' + thrownError + "\n");
        }
    });
    console.log("Exon coordinates done");
  },
  parse_exon_results: function(data) {
    var panel = this;
    if (!data.error) {
      var exon_details = '';
      $("#exon_details_div").html('');

      var exon_in_pdb_count = 0;
      var exon_not_in_pdb = new Object();
      $.each(data,function (index, result) {
        var exon_start = result.start;
        var exon_end   = result.end;
        var exon_pdb_coords = panel.ensp_to_pdb_coords(exon_start,exon_end);

        if ((exon_start < panel.pdb_start && exon_end < panel.pdb_start) || (exon_start > panel.pdb_end && exon_end > panel.pdb_end)) {
          exon_not_in_pdb[index] = 1;
          return true;
        }
        exon_in_pdb_count ++;
      });

      var data_size = Object.keys(data).length;
      var exon_count = 0;
      $.each(data,function (index, result) {

        if (exon_not_in_pdb[index]) {
          return true;
        }

        var exon_number = index + 1;

        var exon_start = result.start;
        var exon_end   = result.end;

        // Remove condon stop at the end of the last exon (1aa)
        if (exon_number == data_size) {
          exon_end--;
        }

        var exon_pdb_coords = panel.ensp_to_pdb_coords(exon_start,exon_end);
        if (exon_pdb_coords.length == 0) {
          return true;
        }
        var exon_pdb_start = exon_pdb_coords[0];
        var exon_pdb_end   = exon_pdb_coords[1];

        // Colour
        var hexa_colour = panel.get_hexa_colour(exon_count, exon_in_pdb_count);

        var exon_label = '<a href="/'+panel.species+'/Transcript/Exons?t='+panel.ensp_id+'">Exon '+exon_number+'</a>';

        var exon_coords = exon_pdb_start+','+exon_pdb_end;

        exon_details += '<tr><td style="border-color:'+hexa_colour+'">'+exon_label+'</td>'+
          '<td>'+exon_pdb_start+'-'+exon_pdb_end+'</td><td>'+exon_start+'-'+exon_end+'</td>'+
          '<td><span class="pdb_feature_entry float_left view_disabled" id="exon_'+exon_number+'_cb" data-value="'+exon_coords+'"'+
          ' data-group="exon_group" data-name="'+exon_number+'" data-colour="'+hexa_colour+'"></span></td></tr>';
     
        exon_count ++;
      });

      var label = (exon_count > 1) ? 'Exons' : 'Exon';

      panel.render_selection_details('exon','exon', label, exon_count, exon_details);
    }
  },

  get_protein_feature_data: function(ensp_id) {
    var panel = this;

    $.ajax({
        url: panel.rest_pr_url+ensp_id+'?feature=protein_feature',        
        method: "GET",
        contentType: "application/json; charset=utf-8",
        success: function (data) {
          if (!data.error) {
            var data_per_type = {};
            $.each(data, function(index,item) {
              if (data_per_type[item.type]) {
                data_per_type[item.type].push(item);
              }
              else {
                data_per_type[item.type] = [item];
              }
            });
            $.each(panel.protein_sources, function(type, url) {
              if (data_per_type[type]) {
                panel.parse_protein_feature_results(data_per_type[type],type);
              }
            });
          }
          panel.parse_protein_feature_results(data,type);
        },
        error: function (xhRequest, ErrorText, thrownError) {
          console.log('ErrorText: ' + ErrorText + "\n");
          console.log('thrownError: ' + thrownError + "\n");
        }
    });
    console.log("Exon coordinates done");
  },
  parse_protein_feature_results: function(data,type) {
    var panel = this;
    if (!data.error) {
      var pf_details = '';
      var pf_count   = 0;

      var lc_type = type.toLowerCase();
     
      data.sort(function(a,b) {
        return a.start - b.start;
      });

      var data_size = Object.keys(data).length;
 
      $.each(data,function (index, result) {
        var pf_pdb_coords = panel.ensp_to_pdb_coords(result.start, result.end);
        if (pf_pdb_coords.length == 0) {
          return true;
        }
        var pf_pdb_start = pf_pdb_coords[0];
        var pf_pdb_end   = pf_pdb_coords[1];

        // Colour
        var hexa_colour = panel.get_hexa_colour(index, data_size);

        var pf_coords = pf_pdb_start+','+pf_pdb_end;

        
        var pf_id = result.id;
        if (panel.protein_sources[type]) {
          var pf_url = panel.protein_sources[type];
              pf_url += (type == 'Gene3D') ? panel.ensp_id : result.id;
          pf_id = '<a href="'+pf_url+'" rel="external">'+result.id+'</a>';
        }
 
        pf_details += '<tr><td style="border-color:'+hexa_colour+'">'+pf_id+'</td>'+
         '<td>'+pf_pdb_start+'-'+pf_pdb_end+'</td><td>'+result.start+'-'+result.end+'</td>'+
         '<td><span class="pdb_feature_entry float_left view_disabled" id="'+type+'_cb" data-value="'+pf_coords+'"'+
         ' data-group="'+lc_type+'_group" data-name="'+result.id+'" data-colour="'+hexa_colour+'"></span></td></tr>';
        
        pf_count ++;
      });

      panel.render_selection_details('protein', lc_type, type, pf_count, pf_details);
    }
  },

  get_sift_polyphen_data: function(ensp_id) {
    var panel = this;

    $.ajax({
        url: panel.rest_pr_url+ensp_id+'?feature=transcript_variation',
        method: "GET",
        contentType: "application/json; charset=utf-8",
        success: function (data) {
          panel.parse_sift_results(data);
          panel.parse_polyphen_results(data);
        },
        error: function (xhRequest, ErrorText, thrownError) {
          console.log('ErrorText: ' + ErrorText + "\n");
          console.log('thrownError: ' + thrownError + "\n");
        }
    });
    console.log("SIFT results done");
  },
  parse_sift_results: function(data) {
    var panel = this; 

    data.sort(function(a,b) {
      return a.start - b.start;
    });

    var sift_details = '';
    var sift_count   = 0;

    var sift_sg = {'score_good' : 'sift_1_sg', 'score_bad' : 'sift_2_sg'};

    var sift_categories = {};

    $.each(data,function (index, result) {
      if (result.sift) {

        var var_pdb_coords = panel.ensp_to_pdb_coords(result.start, result.end);
        if (var_pdb_coords.length == 0) {
          return true;
        }
        var var_pdb_start = var_pdb_coords[0];
        var var_pdb_end   = var_pdb_coords[1];

        var var_pdb  = (var_pdb_start == var_pdb_end) ? var_pdb_start : var_pdb_start+'-'+var_pdb_end;
        var var_ensp = (result.start == result.end) ? result.start : result.start+'-'+result.end;

        var sift_score = result.sift;

        var sift_coords = var_pdb_start+','+var_pdb_end;

        var sift_residues = result.residues;

        if (sift_residues.length > 5) {
          var sift_residues_label = sift_residues.substr(0,2)+'...';
          sift_residues = '<span class="ht" title="'+sift_residues+'">'+sift_residues_label+'</span>';
        }       

        // Colour
        var sift_class  = 'score_good';
        var sift_colour = 'green';
        if (sift_score <= 0.05) {
          sift_class  = 'score_bad';
          sift_colour = 'red';
        }

        sift_categories[sift_class] = 1;

        var var_id = panel.add_var_link(result.id);

        sift_details += '<tr><td style="border-color:'+sift_colour+'">'+var_id+'</td><td>'+var_pdb+'</td><td>'+var_ensp+'</td>'+
          '<td>'+sift_residues+'</td><td><div class="score '+sift_class+'">'+sift_score+'</div></td>'+
          '<td><span class="pdb_feature_entry float_left view_disabled" id="sift_'+result.id+'_cb" data-value="'+sift_coords+'"'+
          ' data-group="sift_group" data-name="'+result.id+'" data-colour="'+sift_colour+'" data-sg="'+sift_sg[sift_class]+'"></span></td></tr>';
        
        sift_count++;
      }
    });

    // Legend
    var legend = '<div class="pdb_legend">';
    if (sift_categories['score_good']) {
      legend += '  <div class="float_left" style="margin-right:10px">'+
                '    <div class="float_left _ht score_legend_left score_good" title="Greater than or equal to 0.05">Tolerated</div>'+
                '    <div class="float_left score_legend_right">'+
                '      <div class="pdb_feature_subgroup view_disabled" title="Click to highlight / hide Tolerated SIFT Variant" id="sift_1_sg" data-super-group="sift_group"></div>'+
                '    </div>'+
                '    <div style="clear:both"></div>'+
                '  </div>';
    }
    if (sift_categories['score_bad']) {
      legend += '  <div class="float_left">'+
                '    <div class="float_left _ht score_legend_left score_bad" title="Less than 0.05">Deleterious</div>'+
                '    <div class="float_left score_legend_right">'+
                '      <div class="pdb_feature_subgroup view_disabled" title="Click to highlight / hide Deleterious SIFT Variant" id="sift_2_sg" data-super-group="sift_group"></div>'+
                '    </div>'+
                '    <div style="clear:both"></div>'+
                '  </div>';
    }
    legend += '  <div style="clear:both"></div>'+
              '</div>';

    panel.render_selection_details('variant','sift', 'SIFT', sift_count, sift_details, 'Residues;Score', legend, 1);
  },
  parse_polyphen_results: function(data) {
    var panel = this;

    data.sort(function(a,b) {
      return a.start - b.start;
    });

    var polyphen_details = '';
    var polyphen_count   = 0;

    var polyphen_sg = {
          'score_good'    : 'polyphen_1_sg',
          'score_ok'      : 'polyphen_2_sg',
          'score_bad'     : 'polyphen_3_sg',
          'score_neutral' : 'polyphen_4_sg'
       };

    var polyphen_categories = {};

    $.each(data,function (index, result) {
      if (result.polyphen) {

        var var_pdb_coords = panel.ensp_to_pdb_coords(result.start, result.end);
        if (var_pdb_coords.length == 0) {
          return true;
        }
        var var_pdb_start = var_pdb_coords[0];
        var var_pdb_end   = var_pdb_coords[1];

        var var_pdb  = (var_pdb_start == var_pdb_end) ? var_pdb_start : var_pdb_start+'-'+var_pdb_end;
        var var_ensp = (result.start == result.end) ? result.start : result.start+'-'+result.end;

        var polyphen_score = result.polyphen;

        var polyphen_coords = var_pdb_start+','+var_pdb_end;

        var polyphen_residues = result.residues;
        if (polyphen_residues.length > 5) {
          var polyphen_residues_label = polyphen_residues.substr(0,2)+'...';
          polyphen_residues = '<span class="ht" title="'+polyphen_residues+'">'+polyphen_residues_label+'</span>';
        }

        // Colour
        var polyphen_class  = 'score_neutral';
        var polyphen_colour = 'blue'; 
        if (polyphen_score > 0.908) {
          polyphen_class  = 'score_bad';
          polyphen_colour = 'red';
        }
        else if (polyphen_score > 0.445 && polyphen_score <= 0.908) {
          polyphen_class  = 'score_ok';
          polyphen_colour = 'orange';
        }
        else if (polyphen_score <= 0.445) {
          polyphen_class  = 'score_good';
          polyphen_colour = 'green';
        }
       
        polyphen_categories[polyphen_class] = 1;

        var var_id = panel.add_var_link(result.id);

        polyphen_details += '<tr><td style="border-color:'+polyphen_colour+'">'+var_id+'</td><td>'+var_pdb+'</td><td>'+var_ensp+'</td>'+
          '<td>'+polyphen_residues+'</td><td><div class="score '+polyphen_class+'">'+polyphen_score+'</div></td>'+
          '<td><span class="pdb_feature_entry float_left view_disabled" id="polyphen_'+result.id+'_cb" data-value="'+polyphen_coords+'"'+
          ' data-group="polyphen_group" data-name="'+result.id+'" data-colour="'+polyphen_colour+'" data-sg="'+polyphen_sg[polyphen_class]+'"></span></td></tr>';
        
        polyphen_count++;
      }
    });

    // Legend
/*    var legend = '<div style="font-size:10px;white-space:nowrap;margin-bottom:5px;margin-left:5px">'+
                 '  <div style="float:left;margin-right:10px"><div class="_ht score score_good" style="max-width:none" title="Less than or equal to 0.446">Benign</div></div>'+
                 '  <div style="float:left;margin-right:10px"><div class="_ht score score_ok" style="max-width:none" title="Greater than 0.446 and less than or equal to 0.908">Possibly Damaging</div></div>'+
                 '  <div style="float:left;margin-right:10px"><div class="_ht score score_bad" style="max-width:none" title="Greater than 0.908">Probably Damaging</div></div>'+
                 '  <div style="float:left"><div class="_ht score score_neutral" style="max-width:none" title="Unknown">Unknown</div></div>'+
                 '  <div style="clear:both"></div>'+
                 '</div>';*/

    var legend = '<div class="pdb_legend">';
    if (polyphen_categories['score_good']) {
      legend += '  <div class="float_left" style="margin-right:10px">'+
                '    <div class="float_left _ht score_legend_left score_good" title="Less than or equal to 0.446">Benign</div>'+
                '    <div class="float_left score_legend_right">'+
                '      <div class="pdb_feature_subgroup view_disabled" title="Click to highlight / hide Benign PolyPhen Variant" id="polyphen_1_sg" data-super-group="polyphen_group"></div>'+
                '    </div>'+
                '    <div style="clear:both"></div>'+
                '  </div>';
    }
    if (polyphen_categories['score_ok']) {
      legend += '  <div class="float_left" style="margin-right:10px">'+
                '    <div class="float_left _ht score_legend_left score_ok" title="Greater than 0.446 and less than or equal to 0.908">Possibly Damaging</div>'+
                '    <div class="float_left score_legend_right">'+
                '      <div class="pdb_feature_subgroup view_disabled" title="Click to highlight / hide Possibly Damaging PolyPhen Variant" id="polyphen_2_sg" data-super-group="polyphen_group"></div>'+
                '    </div>'+
                '    <div style="clear:both"></div>'+
                '  </div>';
    }
    if (polyphen_categories['score_bad']) {
      legend += '  <div class="float_left" style="margin-right:10px">'+
                '    <div class="float_left _ht score_legend_left score_bad" title="Greater than 0.908">Probably Damaging</div>'+
                '    <div class="float_left score_legend_right">'+
                '      <div class="pdb_feature_subgroup view_disabled" title="Click to highlight / hide Probably Damaging PolyPhen Variant" id="polyphen_3_sg" data-super-group="polyphen_group"></div>'+
                '    </div>'+
                '    <div style="clear:both"></div>'+
                '  </div>';
    }
    if (polyphen_categories['score_neutral']) {
      legend += '  <div class="float_left">'+
                '    <div class="float_left _ht score_legend_left score_neutral" title="Unknown">Unknown</div>'+
                '    <div class="float_left score_legend_right">'+
                '      <div class="pdb_feature_subgroup view_disabled" title="Click to highlight / hide Unknown PolyPhen Variant" id="polyphen_4_sg" data-super-group="polyphen_group"></div>'+
                '    </div>'+
                '    <div style="clear:both"></div>'+
                '  </div>';
    }
     
    legend += '  <div style="clear:both"></div>'+
              '</div>';


    panel.render_selection_details('variant','polyphen', 'PolyPhen', polyphen_count, polyphen_details, 'Residues;Score', legend, 1);
  },

  render_selection_details: function (category,type,type_label,type_count,details,extra_col,legend,has_subgroup) {
    var panel = this;

    var cat_id    = category+'_block';
    var td_label  = type+'_label';
    var row_id    = type+'_row';
    var cb_group  = type+'_group';
    var sg_flag   = (has_subgroup) ? ' data-has-sg="1"' : '';

    var label_id     = type+'_details';
    var label_id_div = label_id+'_div';

    
    extra_col = (extra_col) ? '<th>'+extra_col.replace(';','</th><th>')+'</th>' : '';
    view_col  = '<th></th>';

    legend = (legend) ? legend : '';

    if (type_count) {

      var label;
      if ($('#'+td_label).length) {
        label = $('#'+td_label);
      }
      else {
        label = $('<div></div>');
        label.attr('id', td_label);
      }
      label.html(
        '<div>'+
        '  <h3 class="float_left" style="margin-bottom:0px">'+type_label+'</h3>'+
        '  <div class="float_right view_toggle view_toggle_btn closed" rel="'+label_id+'"></div>'+
        '  <div class="float_right pdb_feature_group view_disabled" title="Click to highlight / hide '+type_label+' on the 3D viewer" id="'+cb_group+'"'+sg_flag+'></div>'+
        '  <div class="float_right view_badge">'+type_count+'</div>'+
        '  <div style="clear:both"></div>'+
        '</div>'+
        '<div class="'+label_id+'">'+
        '  <div id="'+label_id_div+'" class="pdb_features_container toggleable" style="padding-top:5px;display:none">'+legend+
        '    <table class="pdb_features"><thead><tr>'+panel.details_header+extra_col+view_col+'</tr></thead><tbody>'+details+'</tbody></table>'+
        '  </div>'+
        '</div>');

      if (!$('#'+row_id).length) {
        var row = $('<div></div>');
            row.attr('id', row_id);
            //row.append(checkbox);
            row.append(label);
        $('#'+cat_id).append(row);
      }
    }
    else if ($('#'+row_id).length) {
      $('#'+row_id).remove();
    }
    $('._ht').helptip();
  },

  ensp_to_pdb_coords: function(start_res, end_res) {
    var panel = this;

    start_res = Number(start_res);
    end_res   = Number(end_res);

    var pdb_res_start;
    var pdb_res_end;

    if ((start_res < panel.pdb_start && end_res < panel.pdb_start) ||
        (start_res > panel.pdb_end && end_res > panel.pdb_end)) {
      return [];
    }

    // Convert to PDB coordinates
    var coords_shift = panel.pdb_hit_start - panel.pdb_start;
//console.log("SHIFT: "+coords_shift);
    if (start_res < panel.pdb_start && end_res > panel.pdb_start) {
      pdb_res_start = panel.pdb_start + coords_shift;
      console.log("ENSP start: "+start_res+" | PDB start: "+panel.pdb_start+" | PDB coord: "+pdb_res_start);
    }

    if (end_res > panel.pdb_end && start_res < panel.pdb_end) {
      pdb_res_end = panel.pdb_end + coords_shift;
      console.log("ENSP end: "+end_res+" | PDB end: "+panel.pdb_end+" | PDB coord: "+pdb_res_end);
    }

    // Convert to PDB coordinates (will need to be fixed properly)
    if (!pdb_res_start) {
      pdb_res_start = start_res + coords_shift;
    }
    if (!pdb_res_end) {
      pdb_res_end = end_res + coords_shift;
    }

    if (pdb_res_start < panel.pdb_hit_start) {
      pdb_res_start = panel.pdb_hit_start;
    }
//console.log("COORDS: ENSP => "+start_res+"-"+end_res+" | PDB => "+pdb_res_start+"-"+pdb_res_end);
    return [pdb_res_start,pdb_res_end];
  },


  ///// Colouration methods /////
  
  sin_to_hex: function(i, phase, size) {
    var sin = Math.sin(Math.PI / size * 2 * i + phase);
    var intg = Math.floor(sin * 127) + 128;
    var hexa = intg.toString(16);

    return hexa.length === 1 ? "0"+hexa : hexa;
  },
  get_hexa_colour: function(index, size) {
    var panel = this;

    var red   = panel.sin_to_hex(index, 0 * Math.PI * 2/3, size); // 0   deg
    var blue  = panel.sin_to_hex(index, 1 * Math.PI * 2/3, size); // 120 deg
    var green = panel.sin_to_hex(index, 2 * Math.PI * 2/3, size); // 240 deg

    var hexa_colour = "#"+ red + green + blue
    panel.add_colour(hexa_colour);

    return hexa_colour;
  },
  add_colour: function(hexa) {
    var panel = this;

    if (!panel.hexa_to_rgb[hexa]) {

      var h=hexa.replace('#', '');
      var bigint = parseInt(h, 16);
      var r_colour = (bigint >> 16) & 255;
      var g_colour = (bigint >> 8) & 255;
      var b_colour = bigint & 255;

      panel.hexa_to_rgb[hexa] = {r:r_colour, g:g_colour, b:b_colour};
    }
  },

  add_var_link: function(var_id) {
    var panel = this;
    return '<a href="/'+panel.species+'/Variation/Explore?v='+var_id+'" target="_blank">'+var_id+'</a>';
  },


  ///// Generic methods /////

  isOdd: function(num) { return num % 2;},

  // Function to retrieve the searched term 
  getParameterByName: function(name, url) {
    if (!url) url = window.location.href;
    name = name.replace(/[\[\]]/g, "\\$&");
    var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
    results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, " "));
  },
  showError: function(message) {
    this.elLk.target.html(message ? message : 'We are currently unable to display data from PDB, please try again later.');
  },
  showMsg: function(message) { 
    $('#ensp_pdb').html(message);
    $('#ensp_pdb').show();  
  },
  showNoData: function() {
    this.showMsg('No data available');
  },
  addSpinner: function() {
    $('#pdb_msg').addClass('spinner');
  },
  removeSpinner: function() {
    $('#pdb_msg').removeClass('spinner');
  }
});

