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
    this.rest_url_root    = 'https://rest.ensembl.org/';
    this.rest_var_url     = this.rest_url_root+'variation/human/';
    this.rest_overlap_url = this.rest_url_root+'overlap/region/human/';
    this.rest_pr_url      = this.rest_url_root+'overlap/translation/';
    this.rest_lookup_url  = this.rest_url_root+'lookup/id/';
    this.rest_pdbe_url    = 'https://www.ebi.ac.uk/pdbe/api/pdb/entry/molecules/';

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
                         '#C8C8C8'    : {r:200, g:200, b:200}
                       };

    this.liteMolScope;
    
    this.var_id;
    this.var_cons;
    this.ensp_id;

    this.ensp_pdb_list = {};
    this.ensp_var_pos  = {};
    this.ensp_length   = {};

    this.pdb_id;
    this.pdb_start;
    this.pdb_end;
    this.pdb_hit_start;
    this.pdb_struct_asym;
    this.pdb_chain_struc_entity = new Object();

    this.details_header = '<th>ID</th><th>PDB coords</th><th>ENSP coords</th>';

    //$.getScript('/pdbe/angular.1.4.7.min.js');//, function () {
    //$.getScript('/pdbe/pdb.component.library.min-1.0.0.js');//, function () {
    $.getScript('/pdbe/litemol-custom-theme.js');//, function () { panel.get_var_data() });

    $(document).ready(function () {
      console.log('doc ready');
      
      panel.addSpinner(); 

      // Transcript portal
      if ($("#ensp_id").length) {
        panel.ensp_id = $("#ensp_id").html();
        panel.get_prot_length(panel.ensp_id);
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

      $('#pdb_list').change(function () {
        var pdb_id = $(this).val();
        panel.selectPDBEntry(pdb_id);
      });

      $(document).on('click', '.pdb_feature_entry', function() {
        panel.selectedFeaturesToHighlight();
      });
      
      $(document).on('click', 'a.toggle', function() {
        var div_id = '#'+$(this).attr('rel')+'_div';
        if ($(this).hasClass('closed')) {
          $(div_id).show();
          $(this).switchClass('closed','open');
        }
        else {
          $(div_id).hide();
          $(this).switchClass('open','closed');
        }
      });

    });
  },

  /*default_display: function() {
    var panel = this;

    var model_default = panel.liteMolScope.LiteMolComponent.plugin.context.select('model')[0];

    if (!model_default && typeof model_default !== "undefined"){
      var coloring_default = {
        //base: panel.hexa_to_rgb['dark_grey'],
        base: panel.hexa_to_rgb['red'],
        entries: []
      };
//      var model_default = panel.liteMolScope.LiteMolComponent.plugin.context.select('model')[0];
      if (!model_default) {
        console.log('No LiteMol model available yet');
        return;
      }
      var theme_default = LiteMolPluginInstance.CustomTheme.createTheme(model_default.props.model, coloring_default);
      LiteMolPluginInstance.CustomTheme.applyTheme(panel.liteMolScope.LiteMolComponent.plugin, 'polymer-visual', theme);
    }
    else {
      setTimeout(panel.default_display, 250);
    }
  },*/
 
  selectPDBEntry: function(pdb_id) {
    var panel = this;

    $('.pdb_feature_entry').prop('checked',false);

    // Check default options
    $('#mapping_cb').prop('checked',true);
    //document.getElementById("mapping_cb").checked = true;
    if (panel.var_id) {
      $('#'+panel.var_id+'_cb').prop('checked',true);
    }

    if (pdb_id && pdb_id != '-') {
      var sel = $('#pdb_list').find('option:selected');
      panel.pdb_id        = pdb_id;
      panel.pdb_start     = Number(sel.attr('data-start'));
      panel.pdb_end       = Number(sel.attr('data-end'));
      panel.pdb_chains    = sel.attr('data-chain').split(',');
      panel.pdb_hit_start = Number(sel.attr('data-hit-start'));
      console.log("PDB coords of "+pdb_id+" (on ENSP): "+panel.pdb_start+'-'+panel.pdb_end);

      // Assign position to variant
      if (panel.var_id) {
        var var_pos_ensp = panel.ensp_var_pos[panel.ensp_id].split('-');
        var var_pdb_coords = panel.ensp_to_pdb_coords(var_pos_ensp[0],var_pos_ensp[1]);

        // Special display for the stop_gained variants
        if (panel.var_cons && (panel.var_cons == 'stop_gained' || panel.var_cons == 'frameshift_variant')) {
          var altered_seq_div_id = 'altered_downstream_seq';
          if ($('#'+altered_seq_div_id).length) {
            $('#'+altered_seq_div_id).remove();
          }
          var var_pos_after_stop =  Number(var_pos_ensp[1]) + 1;
          $('#'+panel.var_id+'_cb').attr('value', var_pos_ensp[0]+','+var_pos_ensp[1]+';'+var_pos_after_stop+','+panel.pdb_end);
          var var_colour = $('#'+panel.var_id+'_cb').attr('data-colour');
          $('#'+panel.var_id+'_cb').attr('data-colour', var_colour+';darkred');
          $('#'+panel.var_id+'_cb').attr('data-highlight', '1;0');
          $('#var_details_div > table > tbody').append('<tr><td id="'+altered_seq_div_id+'" style="border-color:darkred">Altered/missing sequence</td><td>from '+var_pdb_coords[0]+'</td><td>from '+var_pos_ensp[1]+'</td></tr>');
        }
        else {
          $('#'+panel.var_id+'_cb').attr('value', var_pos_ensp[0]+','+var_pos_ensp[1]);
          $('#'+panel.var_id+'_cb').attr('data-highlight', '1');
        }
        var var_pos_pdb = (var_pdb_coords[0] == var_pdb_coords[1]) ? var_pdb_coords[0] : var_pdb_coords[0]+'-'+var_pdb_coords[1];
        $('#var_pos_pdb').html(var_pos_pdb);
        var_pos_ensp = (var_pos_ensp[0] == var_pos_ensp[1]) ? var_pos_ensp[0] : var_pos_ensp[0]+'-'+var_pos_ensp[1];
        $('#var_pos_ensp').html(var_pos_ensp);
      }

      // Assign position to ENSP mapping
      var ensp_pdb_coords = panel.ensp_to_pdb_coords(panel.pdb_start, panel.pdb_end);
      $('#mapping_cb').attr('value', ensp_pdb_coords[0]+','+ensp_pdb_coords[1]);

      $('#mapping_ensp_pos').html(panel.pdb_start+'-'+panel.pdb_end);
      $('#mapping_pdb_pos').html(ensp_pdb_coords[0]+'-'+ensp_pdb_coords[1]);

      // Display the LiteMol canvas
      panel.load3DWidget();

      // When the PDB model has been loaded, highlight the options selected by default
      $( document ).ajaxStop(function() {
        panel.selectedFeaturesToHighlight();
      });

      $('#litemol_buttons').show();

      if (panel.ensp_id) {
        panel.get_exon_data(panel.ensp_id); // Might need to move it into the #ensp_list change block
        panel.get_protein_feature_data(panel.ensp_id,'Pfam');
        panel.get_protein_feature_data(panel.ensp_id,'PRINTS');
        panel.get_protein_feature_data(panel.ensp_id,'Gene3D');
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

   // $.getScript('/pdbe/litemol-custom-theme.js' , function() {
   
      $.getScript('/pdbe/litemol-custom-theme.js').done(function( s, Status ) {

      var pdb_tag = '<pdb-lite-mol id="litemol_pdb_model" pdb-id="\''+panel.pdb_id+'\'" hide-controls="true" fogEnabled="false" show-logs="false"></pdb-lite-mol>';

      panel.removeComponents();

      $("#litemol_canvas").html(pdb_tag);

      var componentElements = $("#litemol_pdb_model");

      angular.bootstrap(componentElements, ['pdb.component.library']);

      // Method to bind component scope
      var bindPdbComponentScope = function(element){
        return angular.element(element).isolateScope();
      }

      panel.liteMolScope = bindPdbComponentScope($('#litemol_pdb_model'));
    });
  },

 
  // Function to remove any existing component instance
  removeComponents: function() {
    $('#litemol_canvas').empty();
  },
  
  selectedFeaturesToHighlight: function() {
    var panel = this;
    var residueDetails = [];
    var specialResidueDetails = [];

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
    LiteMolPluginInstance.CustomTheme.applyTheme(this.liteMolScope.LiteMolComponent.plugin, 'polymer-visual', theme_default);

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
    pdb_feature_entry_array.each(function(index, el) {

      if (el.checked) {  
        var data_colours = el.getAttribute('data-colour');
        var var_colours  = data_colours.split(';');

        var input_value = el.value;
        
        var pos_list = input_value.split(';');
//console.log(">> FEATURE "+el.id+" | "+data_colours+" | "+input_value);
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
                                       color: panel.hexa_to_rgb[var_colour]
                                     };
              residueDetails.push(selectionDetails);

              // Special highlighting with side chaine
              var special_hl = el.getAttribute('data-highlight');
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

    // Implementation from LiteMol core example
    if (panel.liteMolScope) {
             
      var model = panel.liteMolScope.LiteMolComponent.plugin.context.select('model')[0];
      if (!model)
        return;

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
          action.add(model, panel.liteMolScope.LiteMolComponent.Transformer.Molecule.CreateSelectionFromQuery, { query: query, name: 'Selection-'+si }, { ref: 'sequence-selection-'+si })
          .then(panel.liteMolScope.LiteMolComponent.Transformer.Molecule.CreateVisual, { style: panel.liteMolScope.LiteMolComponent.Visualization.Molecule.Default.ForType.get('BallsAndSticks') });
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

    }
  },

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
          //console.log(data);
          panel.parse_var_results(data);
          var coords = data.mappings[0].location;
          var chr_start_end = coords.split(':');
          var start_end = chr_start_end[1].split('-');
          if (start_end[0]>start_end[1]) {
            coords=chr_start_end[0]+":"+start_end[1]+"-"+start_end[0];
          }
          panel.get_proteins_list(coords);
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

  get_proteins_list: function(coords) {
    var panel = this;

    $('#right_form').addClass('loader_small');
    $.ajax({
      url: panel.rest_overlap_url+coords+'?feature=cds',
      method: "GET",
      contentType: "application/json; charset=utf-8",
      success: function (data) {
        panel.parse_prot_results(data);
      },
      error: function (xhRequest, ErrorText, thrownError) {
        console.log('ErrorText: ' + ErrorText + "\n");
        console.log('thrownError: ' + thrownError + "\n");
      }
    });
    console.log("Protein list done");
  },

  parse_prot_results: function(data) {
    var panel = this;
    if (!data.error) {
      var prot_list = [];
      $.each(data,function (index, result) {
        var pr = result.protein_id;
        if (jQuery.inArray(pr,prot_list) == -1) {
          prot_list.push(pr);
          panel.get_prot_length(pr);
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

  get_prot_length: function(ensp) {
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
        }
    });
  },

  get_pdb_list: function(ensp,display) {
    var panel = this;
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
console.log(pdb_id+": "+result.start+"-"+result.end+" (struct_asym "+chains+")");
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
        $("#variant_pos_info").show();
      }
      var pdb_objs = panel.ensp_pdb_list[ensp];
      pdb_objs.sort(function(a,b) {
        return b.size - a.size;
      });
      $('#right_form').removeClass('loader_small');
      $('#pdb_list').hide();
      $('#pdb_list').html('');
      var selected_pdb = '';
      if (pdb_objs.length == 1) {
        var pdb_id = pdb_objs[0].id;
        var pdb_start = pdb_objs[0].start;
        var pdb_end   = pdb_objs[0].end;
        var pdb_hit_start = pdb_objs[0].hit_start;
        var pdb_hit_end   = pdb_objs[0].hit_end;
        var pdb_coord = " - ("+pdb_start+"-"+pdb_end+")";
        var pdb_chain = pdb_objs[0].chain;

        var pdb_mapping_length = pdb_end - pdb_start + 1;
        var ensp_pdb_coverage = (pdb_mapping_length/ensp_length[ensp])*100;
            ensp_pdb_coverage = Math.round(ensp_pdb_coverage * 100) / 100;
 
        var pdb_coord = " - (PDB: "+pdb_hit_start+'-'+pdb_hit_end+" | ENSP: "+pdb_start+"-"+pdb_end+" => "+ensp_pdb_coverage+"% of ENSP)";

        $('#pdb_list').append($('<option>', {
            'value'         : pdb_id,
            'data-start'    : pdb_start,
            'data-end'      : pdb_end,
            'data-hit-start': pdb_hit_start,
            'data-chain'    : pdb_struct_asym,
            'text'          : pdb_id+pdb_coord,
            'selected'      : 'selected'
        }));
        selected_pdb = pdb_id;
      }
      else {
        $('#pdb_list').append($('<option>', {
          value: '-',
          text : '-'
        }));
        var first_pdb_entry = 1;

        $.each(pdb_objs, function (i, pdb_obj) {
          var pdb_mapping_length = pdb_obj.end - pdb_obj.start + 1;
          var ensp_pdb_coverage = (pdb_mapping_length/panel.ensp_length[ensp])*100;
              ensp_pdb_coverage = Math.round(ensp_pdb_coverage * 100) / 100;
          var pdb_coord = " - (PDB: "+pdb_obj.hit_start+'-'+pdb_obj.hit_end+" | ENSP: "+pdb_obj.start+"-"+pdb_obj.end+" => "+ensp_pdb_coverage+"% of ENSP)";

          var pdb_option = {
                 'value'         : pdb_obj.id,
                 'data-start'    : pdb_obj.start,
                 'data-end'      : pdb_obj.end,
                 'data-hit-start': pdb_obj.hit_start,
                 'data-chain'    : pdb_obj.chain,
                 'text'          : pdb_obj.id + pdb_coord
              };
          if (first_pdb_entry == 1) {
            pdb_option['selected'] = 'selected';
            selected_pdb = pdb_obj.id;
            first_pdb_entry = 0;
          }
          $('#pdb_list').append($('<option>', pdb_option));
        });

      }
      $('#pdb_list').show();
      panel.selectPDBEntry(selected_pdb);
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
      var exon_colours = [];
      var exon_coords = '';
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
        //var hexa_colour = panel.get_hexa_colour(index, data_size);
        var hexa_colour = panel.get_hexa_colour(exon_count, exon_in_pdb_count);
        exon_colours.push(hexa_colour);

        //exon_details += '<div style="padding-left:2px;margin-bottom:1px;border-left:5px solid '+hexa_colour+'"><b>Exon '+exon_number+'</b>: '+exon_pdb_start+'-'+exon_pdb_end+' (ENSP: '+exon_start+'-'+exon_end+')</div>';
        exon_details += '<tr><td style="border-color:'+hexa_colour+'">Exon '+exon_number+'</td><td>'+exon_pdb_start+'-'+exon_pdb_end+'</td><td>'+exon_start+'-'+exon_end+'</td></tr>';
        if (exon_coords != '') {
          exon_coords += ';';
        }
        exon_coords += exon_pdb_start+','+exon_pdb_end;
        exon_count ++;
      });
      $('#exon_count').html(exon_coords.split(';').length);
      $('#exon_cb').val(exon_coords);
      $('#exon_cb').attr('data-colour', exon_colours.join(';'));
      $("#exon_details_div").html('<table class="pdb_features"><thead><tr>'+panel.details_header+'</tr></thead><tbody>'+exon_details+'</tbody></table>');
    }
  },

  get_protein_feature_data: function(ensp_id,type) {
    var panel = this;

    $.ajax({
        url: panel.rest_pr_url+ensp_id+'?feature=protein_feature;type='+type,
        method: "GET",
        contentType: "application/json; charset=utf-8",
        success: function (data) {
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
      var pf_colours = [];
      var pf_coords = '';
      var pf_details = '';
      
      var lc_type = type.toLowerCase();
     
      data.sort(function(a,b) {
        return a.start - b.start;
      });

      var data_size = Object.keys(data).length;
 
      $.each(data,function (index, result) {
console.log("TYPE: "+type);
        var pf_pdb_coords = panel.ensp_to_pdb_coords(result.start, result.end);
        if (pf_pdb_coords.length == 0) {
          return true;
        }
        var pf_pdb_start = pf_pdb_coords[0];
        var pf_pdb_end   = pf_pdb_coords[1];

        // Colour
        var hexa_colour = panel.get_hexa_colour(index, data_size);
        pf_colours.push(hexa_colour);

        var exon_number = index + 1;       
 
        pf_details += '<tr><td style="border-color:'+hexa_colour+'">'+result.id+'</td><td>'+pf_pdb_start+'-'+pf_pdb_end+'</td><td>'+result.start+'-'+result.end+'</td></tr>';
       if (pf_coords != '') {
          pf_coords += ';';
        }
        pf_coords += pf_pdb_start+','+pf_pdb_end;
      });

      panel.render_selection_details(lc_type, type, pf_coords, pf_colours, pf_details);
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

    var sift_coords = '';
    var sift_details = '';
    var sift_colours = [];

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

        // Colour
        var sift_colour = 'green';
        if (sift_score <= 0.05) {
          sift_colour = 'red';
        }

        sift_details += '<tr><td style="border-color:'+sift_colour+'">'+result.id+'</td><td>'+var_pdb+'</td><td>'+var_ensp+'</td><td>'+sift_score+'</td></tr>';
        if (sift_coords != '') {
          sift_coords += ';';
        }
        sift_coords += var_pdb_start+','+var_pdb_end;
        sift_colours.push(sift_colour);
      }
    });

    panel.render_selection_details('sift', 'SIFT', sift_coords, sift_colours, sift_details,'Score');
  },
  parse_polyphen_results: function(data) {
    var panel = this;

    data.sort(function(a,b) {
      return a.start - b.start;
    });

    var polyphen_coords = '';
    var polyphen_details = '';
    var polyphen_colours = [];

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

        // Colour
        var polyphen_colour = 'blue';
        if (polyphen_score > 0.908) {
          polyphen_colour = 'red';
        }
        else if (polyphen_score > 0.445 && polyphen_score <= 0.908) {
          polyphen_colour = 'orange';
        }
        else if (polyphen_score <= 0.445) {
          polyphen_colour = 'green';
        }

        polyphen_details += '<tr><td style="border-color:'+polyphen_colour+'">'+result.id+'</td><td>'+var_pdb+'</td><td>'+var_ensp+'</td><td>'+polyphen_score+'</td></tr>';
        if (polyphen_coords != '') {
          polyphen_coords += ';';
        }
        polyphen_coords += var_pdb_start+','+var_pdb_end;
        polyphen_colours.push(polyphen_colour);
      }
    });

    panel.render_selection_details('polyphen', 'PolyPhen', polyphen_coords, polyphen_colours, polyphen_details,'Score');
  },

  render_selection_details: function (type,type_label,coords,colours,details,extra_col) {
    var panel = this;

    var td_sel   = type+'_sel';
    var cb_sel   = type+'_cb';
    var td_label = type+'_label';
    var row_id   = type+'_row';

    var label_id     = type+'_details';
    var label_id_div = label_id+'_div';

    extra_col = (extra_col) ? '<th>'+extra_col+'</th>' : '';

    if (coords && coords != '') {

      var type_count = coords.split(';').length;

      var checkbox;
      if ($('#'+td_sel).length) {
        checkbox = $('#'+td_sel);
      }
      else {
        checkbox = $('<td></td>');
        checkbox.attr('id', td_sel);
        //checkbox.css('border-right','5px solid #000');
      }
      checkbox.html('<input class="pdb_feature_entry" id="'+cb_sel+'" value="'+coords+'" data-name="" data-colour="'+colours.join(";")+'" type="checkbox"/>');

      var label;
      if ($('#'+td_label).length) {
        label = $('#'+td_label);
      }
      else {
        label = $('<td></td>');
        label.attr('id', td_label);
      }
      label.html(
        '<div>'+
        '  <div style="float:left">'+type_label+' ('+type_count+') </div>'+
        '  <div style="float:right"><a rel="'+label_id+'" class="toggle_link toggle _slide_toggle set_cookie closed"></a></div>'+
        '  <div style="clear:both"></div>'+
        '</div>'+
        '<div class="'+label_id+'">'+
        '  <div id="'+label_id_div+'" class="toggleable" style="padding-top:5px;display:none">'+
        '    <table class="pdb_features"><thead><tr>'+panel.details_header+extra_col+'</tr></thead><tbody>'+details+'</tbody></table>'+
        '  </div>'+
        '<div>');

      if (!$('#'+row_id).length) {
        var row = $('<tr></tr>');
            row.attr('id', row_id);
            row.append(checkbox);
            row.append(label);
        $('#pdb_markup > tbody').append(row);
      }
    }
    else if ($('#'+row_id).length) {
      $('#'+row_id).remove();
    }
  },

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
