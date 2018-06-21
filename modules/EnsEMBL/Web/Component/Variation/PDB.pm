=head1 LICENSE

Copyright [1999-2015] Wellcome Trust Sanger Institute and the EMBL-European Bioinformatics Institute
Copyright [2016-2017] EMBL-European Bioinformatics Institute

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

     http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

=cut

package EnsEMBL::Web::Component::Variation::PDB;

use strict;

use HTML::Entities qw(encode_entities);
use URI::Escape;

use base qw(EnsEMBL::Web::Component::Variation);

sub _init {
  my $self = shift;
  $self->cacheable(0);
  $self->ajaxable(1);  
}

sub content {
  my $self      = shift;

  my $hub       = $self->hub;
  my $object    = $self->object;
  my $variation = $object->Obj;
  my $species   = $hub->species;
  
  my $var_id    = $hub->param('v');
  my $var_label = $var_id."_cb";
  my $vf        = $hub->param('vf');

  my $variation_features = $variation->get_all_VariationFeatures;
  my $msc;

  foreach my $vf_object (@$variation_features) {
    if ($vf_object->dbID == $vf) {
      my $overlap_consequences = [$vf_object->most_severe_OverlapConsequence] || [];
      # Sort by rank, with only one copy per consequence type
      my @consequences = sort {$a->rank <=> $b->rank} (values %{{map {$_->label => $_} @{$overlap_consequences}}});
      $msc = $consequences[0];
      last;
    }
  }

  return "No overlapping protein" unless ($msc && $msc->rank < 17);

  my $html = qq{
  <input class="panel_type" value="PDB" type="hidden" />
  
  <!-- Complied & minified library css -->
  <link rel="stylesheet" href="//www.ebi.ac.uk/pdbe/pdb-component-library/v1.0/css/pdb.component.library.min-1.0.0.css" />

  <!-- Dependencey scripts (these can be skipped if already included in page) -->
  <!--<script src="//www.ebi.ac.uk/pdbe/pdb-component-library/libs/d3.min.js"></script>-->
  <script src="/pdbe/d3.min.js"></script>
  <script src="//www.ebi.ac.uk/pdbe/pdb-component-library/libs/angular.1.4.7.min.js"></script>
  <!--<script src="/pdbe/angular.1.4.7.min.js"></script>-->

  <!-- Complied & minified library JS -->
  <script src="//www.ebi.ac.uk/pdbe/pdb-component-library/v1.0/js/pdb.component.library.min-1.0.0.js"></script>
  <!--<script src="/pdbe/pdb.component.library.min-1.0.0.js"></script>-->
  <!--<script src="//www.ebi.ac.uk/~lgil/tests/3d/popup/litemol-custom-theme.js"></script>-->
  <!--<script src="http://ves-hx2-76.ebi.ac.uk:5060/pdbe/litemol-custom-theme.js"></script>-->
  
  <h2>Variant <span id="var_id">$var_id</span> <small>(<span id="msc_var"></span>)</small></h2>

  <div id="pdb_msg"></div>  

  <div id="ensp_pdb" style="padding-bottom:6px;display:none">
    <div style="float:left;padding-right:5px">Select protein and model: </div>
    <div style="float:left">
      <form>
       <select id="ensp_list"></select>
       <select id="pdb_list" style="display:none;margin-left:5px"></select>
      </form>
    </div>
    <div id="right_form" style="float:left;margin-left:15px"></div>
    <div style="clear:both"></div>
  </div>
  
  <div id="variant_pos_info" style="display:none">
    <span id="var_ensp_id"></span><span class="var_pos"></span>
  </div>

  <div style="margin-bottom:300px">

    <div id="litemol_canvas" style="float:left;position:relative;height:600px;width:800px;">
      <!-- Canvas for PDB LiteMol-->
    </div>

    <div id="litemol_buttons" style="float:left;margin-left:20px;display:none">
      <table id="pdb_markup" class="ss">
      <thead>
        <tr><th>Data type</th></tr>
      </thead>
      <tbody>

        <tr>
          <td>
            <div>
              <div class="cb">
                <input class="pdb_feature_group" id="mapping_group" type="checkbox"/>
              </div>
              <div style="float:left;vertical-align:middle">ENSP-PDB mapping coverage</div>
              <div style="float:right"><a rel="mapping_details" href="#" class="toggle_link toggle _slide_toggle set_cookie open"></a></div>
              <div style="clear:both"></div>
            </div>
            <div class="mapping_details">
              <div id="mapping_details_div" class="pdb_features_container toggleable" style="padding-top:5px">
                <table class="pdb_features">
                  <thead><tr><th>Label</th><th>PDB coords</th><th>ENSP coords</th></tr></thead>
                  <tbody>
                    <tr><td style="border-color:#C8C8C8"><input class="pdb_feature_entry" id="mapping_cb" value="" data-group="mapping_group" data-name="Mapping" data-colour="#C8C8C8" type="checkbox"/> Coverage</td><td id="mapping_pdb_pos"></td><td id="mapping_ensp_pos"></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>

        <tr>
          <td>
            <div>
              <div class="cb">
                <input class="pdb_feature_group" id="variant_group" type="checkbox"/>
              </div>
              <div style="float:left;vertical-align:middle">Variant ($var_id)</div>
              <div style="float:right"><a rel="var_details" href="#" class="toggle_link toggle _slide_toggle set_cookie open"></a></div>
              <div style="clear:both"></div>
            </div>
            <div class="var_details">
              <div id="var_details_div" class="pdb_features_container toggleable" style="padding-top:5px">
                <table class="pdb_features">
                  <thead><tr><th>ID</th><th>PDB coords</th><th>ENSP coords</th></tr></thead>
                  <tbody>
                    <tr><td style="border-color:red"><input class="pdb_feature_entry pdb_var_entry" id="$var_label" value="" data-group="variant_group"  data-name="$var_id" data-colour="red" data-highlight="1" type="checkbox"/> $var_id</td><td id="var_pos_pdb"></td><td id="var_pos_ensp"></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>

        <tr>
          <td>
            <div>
              <div class="cb">
                <input class="pdb_feature_group" id="exon_group" type="checkbox"/>
              </div>            
              <div style="float:left;vertical-align:middle">Exons (<span id="exon_count"></span>) </div>
              <div style="float:right"><a rel="exon_details" href="#" class="toggle_link toggle _slide_toggle set_cookie open"></a></div>
              <div style="clear:both"></div>
            </div>
            <div class="exon_details">
              <div id="exon_details_div" class="pdb_features_container toggleable" style="padding-top:5px"></div>
            </div>
          </td>
        </tr>

      </tbody>
      </table>
    </div>
    
    <div style="clear:both"></div>
    
  </div>
};

    

  return $html;
}

1;
