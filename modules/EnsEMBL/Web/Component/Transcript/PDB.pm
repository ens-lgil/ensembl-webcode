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

package EnsEMBL::Web::Component::Transcript::PDB;

use strict;

use HTML::Entities qw(encode_entities);
use URI::Escape;

use base qw(EnsEMBL::Web::Component::Transcript);

sub _init {
  my $self = shift;
  $self->cacheable(0);
  $self->ajaxable(1);  
}

sub content {
  my $self        = shift;

  my $hub         = $self->hub;
  my $object      = $self->object;
  my $html;
  if ($object->Obj->isa('Bio::EnsEMBL::Transcript')) {
    #my $stable_id      = $hub->param('g'); 
    my $species     = $hub->species;
    my $translation = $object->translation_object;
    return unless $translation;
  
    my $translation_id = $translation->stable_id;

    $html .= qq{
  <input class="panel_type" value="PDB" type="hidden" />
  
  <!-- Complied & minified library css -->
  <link rel="stylesheet" href="https://www.ebi.ac.uk/pdbe/pdb-component-library/v1.0/css/pdb.component.library.min-1.0.0.css" />

  <!-- Dependencey scripts (these can be skipped if already included in page) -->
  <!--<script src="http://www.ebi.ac.uk/pdbe/pdb-component-library/libs/d3.min.js"></script>-->
  <script src="/pdbe/d3.min.js"></script>
  <script src="https://www.ebi.ac.uk/pdbe/pdb-component-library/libs/angular.1.4.7.min.js"></script>
  <!--<script src="/pdbe/angular.1.4.7.min.js"></script>-->

  <!-- Complied & minified library JS -->
  <script src="https://www.ebi.ac.uk/pdbe/pdb-component-library/v1.0/js/pdb.component.library.min-1.0.0.js"></script>
  <!--<script src="/pdbe/pdb.component.library.min-1.0.0.js"></script>-->
  <!--<script src="//www.ebi.ac.uk/~lgil/tests/3d/popup/litemol-custom-theme.js"></script>-->
  <!--<script src="http://ves-hx2-76.ebi.ac.uk:5060/pdbe/litemol-custom-theme.js"></script>-->
  
  <h2>3D representation of the Ensembl protein <span id="ensp_id">$translation_id</span></h2>
   
  <div id="pdb_msg"></div>

  <div id="ensp_pdb" style="padding-bottom:6px;display:none">
    <div style="float:left;padding-right:5px">Select PDB model: </div>
    <div style="float:left">
      <form>
       <!--<select id="ensp_list"></select>-->
       <select id="pdb_list" style="display:none;margin-left:5px"></select>
      </form>
    </div>
    <div id="right_form" style="float:left;margin-left:15px"></div>
    <div style="clear:both"></div>
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

  }    

  return $html;
}

1;
