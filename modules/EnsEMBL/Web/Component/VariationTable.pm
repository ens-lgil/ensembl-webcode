=head1 LICENSE

Copyright [1999-2015] Wellcome Trust Sanger Institute and the EMBL-European Bioinformatics Institute

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

package EnsEMBL::Web::Component::VariationTable;

use strict;

use Bio::EnsEMBL::Variation::Utils::Constants;
use EnsEMBL::Web::NewTable::NewTable;

use base qw(EnsEMBL::Web::Component::Variation);

sub _init {
  my $self = shift;
  $self->cacheable(0);
  $self->ajaxable(1);
}

sub new_consequence_type {
  my $self        = shift;
  my $tva         = shift;
  my $most_severe = shift;

  my $overlap_consequences = ($most_severe) ? [$tva->most_severe_OverlapConsequence] || [] : $tva->get_all_OverlapConsequences || [];

  # Sort by rank, with only one copy per consequence type
  my @consequences = sort {$a->rank <=> $b->rank} (values %{{map {$_->label => $_} @{$overlap_consequences}}});

  my @type;
  foreach my $c (@consequences) {
    push @type,$c->label;
  }
  return join('~',@type);
}


sub table_content {
  my ($self,$callback) = @_;

  my $hub = $self->hub;
  my $consequence_type = $hub->param('sub_table');
  my $icontext         = $hub->param('context') || 100;
  my $gene_object      = $self->configure($icontext, $consequence_type);
  my $object_type      = $hub->type;
  my @transcripts      = sort { $a->stable_id cmp $b->stable_id } @{$gene_object->get_all_transcripts};
  
  if ($object_type eq 'Transcript') {
    my $t = $hub->param('t');
    @transcripts = grep $_->stable_id eq $t, @transcripts;
  }
  return $self->variation_table($callback,$consequence_type,\@transcripts);
}

sub content {
  my $self             = shift;
  my $hub              = $self->hub;
  my $object_type      = $self->hub->type;
  my $consequence_type = $hub->param('sub_table');
  my $icontext         = $hub->param('context') || 100;
  my $sum_type         = $hub->param('summary_type') || 'table';
  my $gene_object      = $self->configure($icontext, $consequence_type);
  my @transcripts      = sort { $a->stable_id cmp $b->stable_id } @{$gene_object->get_all_transcripts};
  my ($count, $msg, $html);
  
  if ($object_type eq 'Transcript') {
    my $t = $hub->param('t');
    @transcripts = grep $_->stable_id eq $t, @transcripts;
  }
  
  $count += scalar @{$_->__data->{'transformed'}{'gene_snps'}} for @transcripts;

  if ($icontext) {
    if ($icontext eq 'FULL') {
      $msg = "<p>The <b>full</b> intronic sequence around this $object_type is used.";
    } else {
      $msg = "<p>Currently <b>$icontext"."bp</b> of intronic sequence is included either side of the exons.";
    }
    
    $msg .= qq( To extend or reduce the intronic sequence, use the "<b>Configure this page - Intron Context</b>" link on the left.</p>);
  }
  
  $msg .= qq(<p>Note: From release 68, Ensembl uses Sequence Ontology (SO) terms to describe consequences. <a href="/info/genome/variation/predicted_data.html#consequence_type_table">More information about this table</a>.</p>);

  if ($consequence_type || $count < 25) {
    $consequence_type ||= 'ALL';

    my $table      = $self->make_table($consequence_type);

    $html = $self->render_content($table, $consequence_type);
  } else {
    $html  = $self->_hint('snp_table', 'Configuring the page', $msg);
    $html .= $self->render_content($sum_type eq 'tree' ? $self->tree(\@transcripts, $gene_object) : $self->stats_table(\@transcripts, $gene_object)->render); # no sub-table selected, just show stats
  }
  
  return $html;
}

sub all_terms {
  my (%labels);

  my @all_cons     = grep $_->feature_class =~ /transcript/i, values %Bio::EnsEMBL::Variation::Utils::Constants::OVERLAP_CONSEQUENCES;
  foreach my $con (@all_cons) {
    next if $con->SO_accession =~ /x/i;
    my $term = $con->SO_term;
    $labels{$term} = $con->label;
  }
  return \%labels;
}
  
sub sift_poly_classes {
  my ($self,$table) = @_;

  my %sp_classes = (
    '-'                 => '',
    'probably damaging' => 'bad',
    'possibly damaging' => 'ok',
    'benign'            => 'good',
    'unknown'           => 'neutral',
    'tolerated'         => 'good',
    'deleterious'       => 'bad',
    'tolerated - low confidence'   => 'neutral',
    'deleterious - low confidence' => 'neutral',
    'tolerated low confidence'     => 'neutral',
    'deleterious low confidence'   => 'neutral',
  );
  foreach my $column_name (qw(sift polyphen)) {
    my $value_column = $table->column("${column_name}_value");
    my $class_column = $table->column("${column_name}_class");
    $value_column->value('DecorateEditorial')->set_type('lozenge');
    $value_column->value('DecorateEditorial')->set_source($class_column);
    foreach my $pred (keys %sp_classes) {
      my $value = $value_column->value('DecorateEditorial',$pred);
      $value->set_css_class("score_$sp_classes{$pred}");
      $value->set_helptip($pred);
    } 
  }
}

sub evidence_classes {
  my ($self,$table) = @_;

  my @evidence_order = reverse qw(
    1000Genomes HapMap Cited ESP Frequency
    Multiple_observations Phenotype_or_Disease
  );
  my %evidence_order;
  $evidence_order{$evidence_order[$_]} = sprintf("%8d",$_) for(0..$#evidence_order);

  my $evidence_col = $table->column('status');
  foreach my $ev (keys %evidence_order) {
    my $evidence_label = $ev;
    $evidence_label =~ s/_/ /g;
    my $icon = $evidence_col->value('DecorateIconic',$ev);
    $icon->set_icon(sprintf("%s/val/evidence_%s.png",$self->img_url,$ev));
    $icon->set_helptip($evidence_label);
    $icon->set_export($evidence_label);
    $icon->set_order($evidence_order{$ev});
  }
}

sub clinsig_classes {
  my ($self,$table) = @_;
  
  # This order is a guess at the most useful and isn't strongly motivated.
  # Feel free to rearrange.
  my @clinsig_order = reverse qw(
    pathogenic protective likely-pathogenic risk-factor drug-response
    confers-sensitivity histocompatibility association likely-benign
    benign other not-provided uncertain-significance
  );
  my %clinsig_order;
  $clinsig_order{$clinsig_order[$_]} = sprintf("%8d",$_) for(0..$#clinsig_order);

  my $clinsig_col = $table->column('clinsig');
  foreach my $cs_img (keys %clinsig_order) {
    my $cs = $cs_img;
    $cs =~ s/-/ /g;
    my $icon = $clinsig_col->value('DecorateIconic',$cs);
    $icon->set_icon(sprintf("%s/val/clinsig_%s.png",$self->img_url,$cs_img));
    $icon->set_helptip($cs);
    $icon->set_export($cs);
    $icon->set_order($clinsig_order{$cs_img});
  }
}
  
sub snptype_classes {
  my ($self,$table,$hub) = @_;

  my $species_defs = $hub->species_defs;
  my $var_styles   = $species_defs->colour('variation');
  my @all_cons     = grep $_->feature_class =~ /transcript/i, values %Bio::EnsEMBL::Variation::Utils::Constants::OVERLAP_CONSEQUENCES;
  my $column = $table->column('snptype');
  foreach my $con (@all_cons) {
    next if $con->SO_accession =~ /x/i;
    
    my $term = $con->SO_term;
  
    my $so_term = lc $con->SO_term;
    my $colour = $var_styles->{$so_term||'default'}->{'default'};
    my $value = $column->value('DecorateIconic',$con->label);
    $value->set_export($con->label);
    $value->set_order(sprintf("^%8.8d",$con->rank));
    $value->set_helptip($con->description);
    $value->set_coltab($colour);
  }
}

sub make_table {
  my ($self,$consequence_type) = @_;

  my $hub      = $self->hub;
  my $glossary = $hub->glossary_lookup;
  
  my $table = EnsEMBL::Web::NewTable::NewTable->new($self);
  $table->add_phase("taster",[0,50]);
  $table->add_phase("outline",undef,[qw(ID Source)]);
  $table->add_phase("full");
  
  my $sd = $hub->species_defs->get_config($hub->species, 'databases')->{'DATABASE_VARIATION'};
  my $id = $table->add_column('ID',{
    sort => 'string',
  });
  $id->set_width(2);
  $id->no_filter();
  $id->set_helptip('Variant identifier'); 
  my $base_url = $hub->url({
    type   => 'Variation',
    action => 'Summary',
    vf     => undef,
    v      => undef,
  });
  $id->value('DecorateLink')->set_url($base_url,{ vf => "vf" });

  my $vf = $table->add_column('vf',{
    sort => 'numeric',
  });
  $vf->set_type('screen',{ unshowable => 1 });
  $vf->no_filter();

  my $chr = $table->add_column('chr',{
    sort => 'position',
  });
  $chr->no_filter();
  $chr->set_width(1.75);
  $chr->set_label('Chr: bp');
  $chr->set_helptip($glossary->{'Chr:bp'});
  
  my $location = $table->add_column('location',{
    sort => 'position',
  });
  $location->set_type('screen',{ unshowable => 1 });
  $location->set_type('sort_for',{ col => 'chr' });

  my $alleles = $table->add_column('Alleles',{
    sort => 'string',
  });
  $alleles->no_filter();
  $alleles->set_width(2);
  $alleles->set_label("Alle\fles");
  $alleles->set_helptip('Alternative nucleotides');
  $alleles->no_sort();
  my $vf_allele = $table->add_column('vf_allele',{
    sort => 'string',
  });
  $vf_allele->no_filter();
  $vf_allele->set_type('screen',{ unshowable => 1 });
  my $vf_allele_col = $table->column('vf_allele');
  my $alleles_col = $table->column('Alleles');
  $alleles_col->value('DecorateToggle')->set_separator('/');
  $alleles_col->value('DecorateToggle')->set_maxlen(20);
  $alleles_col->value('DecorateToggle')->set_highlight_column($vf_allele_col);
  $alleles_col->value('DecorateToggle')->set_highlight_over(2);
 
  if ($hub->species eq 'Homo_sapiens') {
    my $gmaf = $table->add_column('gmaf',{
      sort => 'numeric',
    });
    $gmaf->set_label("Glo\fbal MAF");
    $gmaf->set_helptip($glossary->{'Global MAF'});
    my $gmaf_allele = $table->add_column('gmaf_allele',{
      sort => 'string',
    });
    $gmaf_allele->no_filter();
    $gmaf_allele->set_type('screen',{ unshowable => 1 });
    $gmaf->value('DecorateAlso')->set_cols($gmaf_allele);
  }
  
  if($hub->param('hgvs') eq 'on') {
    my $hgvs = $table->add_column('HGVS',{
      sort => 'string',
    });
    $hgvs->no_filter();
    $hgvs->set_width(1.75);
    $hgvs->set_label('HGVS name(s)');
  }
  
  my $class = $table->add_column('class',{
    sort => 'string',
  });
  $class->set_width(2);
  $class->set_label('Class');
  $class->set_helptip($glossary->{'Class'});
  
  my $source = $table->add_column('Source',{
    sort => 'string',
  });
  $source->set_width(1.25);
  $source->set_label("Sour\fce");
  $source->set_helptip($glossary->{'Source'});
  
  if($self->isa('EnsEMBL::Web::Component::LRG::VariationTable')) {
    # export_options => { split_newline => 2 }
    my $sub = $table->add_column('Submitters',{
      sort => 'string',
    });
    $sub->no_filter();
    $sub->set_width(1.75);
  }

  my $evidence = $table->add_column('status',{
    sort => 'iconic',
  });
  $evidence->set_width(1.5);
  $evidence->set_label("Evid\fence");
  $evidence->set_helptip($glossary->{'Evidence status (variant)'});
  $self->evidence_classes($table);

  my $clinsig = $table->add_column('clinsig',{
    sort => 'iconic',
  });
  $clinsig->set_label("Clin\fsig");
  $clinsig->set_helptip('Clinical significance');
  $self->clinsig_classes($table);

  my $snptype = $table->add_column('snptype',{
    sort => 'iconic',
  });
  $snptype->set_primary();
  $snptype->set_range([values %{$self->all_terms}]);
  $snptype->set_width(1.5);
  $snptype->set_label('Type');
  $snptype->set_helptip('Consequence type');
  $self->snptype_classes($table,$self->hub);

  my $aachange = $table->add_column('aachange',{
    sort => 'string',
  });
  $aachange->no_filter();
  $aachange->no_sort();
  $aachange->set_label('AA');
  $aachange->set_helptip('Resulting amino acid(s)');

  my $aacoord = $table->add_column('aacoord',{
    sort => 'integer',
  });
  $aacoord->set_label("AA co\ford");
  $aacoord->set_helptip('Amino Acid Co-ordinate');
  
  if ($sd->{'SIFT'}) {
    my $sift_sort = $table->add_column('sift_sort',{
      sort => 'numeric',
    });
    $sift_sort->no_filter();
    $sift_sort->set_type('screen',{ unshowable => 1 });
    $sift_sort->set_type('sort_for',{ col => 'sift_value' });

    my $sift_class = $table->add_column('sift_class',{
      sort => 'iconic',
    });
    $sift_class->no_filter();
    $sift_class->set_helptip($glossary->{'SIFT'});
    $sift_class->set_type('screen',{ unshowable => 1 });

    my $sift_value = $table->add_column('sift_value',{
      sort => 'numeric',
    });
    $sift_value->set_label("SI\aFT");
    $sift_value->set_helptip($glossary->{'SIFT'});
  }
  if ($hub->species eq 'Homo_sapiens') {
    my $polyphen_sort = $table->add_column('polyphen_sort',{
      sort => 'numeric',
    });
    $polyphen_sort->no_filter();
    $polyphen_sort->set_helptip($glossary->{'PolyPhen'});
    $polyphen_sort->set_type('screen',{ unshowable => 1 });
    $polyphen_sort->set_type('sort_for',{ col => 'polyphen_value' });
    my $polyphen_class = $table->add_column('polyphen_class',{
      sort => 'iconic',
    });
    $polyphen_class->no_filter();
    $polyphen_class->set_type('screen',{ unshowable => 1 });
    my $polyphen_value = $table->add_column('polyphen_value',{
      sort => 'numeric',
    });
    $polyphen_value->set_label("Poly\fPhen");
    $polyphen_value->set_helptip($glossary->{'PolyPhen'});
  }
  if ($hub->type ne 'Transcript') {
    my $transcript = $table->add_column('Transcript',{
      sort => 'string',
    });
    $transcript->set_width(2);
    $transcript->set_helptip($glossary->{'Transcript'});
    my $base_trans_url;
    if ($self->isa('EnsEMBL::Web::Component::LRG::VariationTable')) {
      my $gene_stable_id = "XXX"; # XXX fix before release
      $base_trans_url = $hub->url({
        type    => 'LRG',
        action  => 'Summary',
        lrg     => $gene_stable_id,
        __clear => 1
      });
      die "UNIMPLEMENTED: mail dan\@ebi.ac.uk\n";
    } else {
      $base_trans_url = $hub->url({
        type   => 'Transcript',
        action => 'Summary',
      });
      $table->column('Transcript')->value('DecorateLink')->set_url($base_trans_url,{
        t => "Transcript"
      });
    }
  }
  $self->sift_poly_classes($table);
  return $table;
}

sub render_content {
  my ($self, $table, $consequence_type) = @_;
  my $stable_id = $self->object->stable_id;
  my $html;
  
  if ($consequence_type) {
    my $table_id          = $self->hub->param('table_title') || $consequence_type;
    my $consequence_label = ucfirst $table_id;
       $consequence_label =~ s/_/ /g;
       $consequence_label =~ s/children/\(with children\)/;
    
    $html = $table->render($self->hub,$self);
  } else {
    my $hub      = $self->hub;
    my $current  = $hub->param('summary_type') || 'table';
    my $switched = $current eq 'tree' ? 'table' : 'tree';
    my $url      = $hub->url({ summary_type => $switched });
    
    $html = qq(
      <a id="$self->{'id'}_top"></a>
      <span style="float:right;">
        <a href="$url">Switch to $switched view <img src="/i/16/reload.png" height="12px"/></a>
      </span>
      <h2>Summary of variant consequences in $stable_id</h2>
    ) . $table;
  }
  
  return $html;
}


sub stats_table {
  my ($self, $transcripts, $gene_object) = @_;
  my $hub     = $self->hub;
  my $columns = [
    { key => 'count', title => 'Number of variant consequences', sort => 'numeric_hidden', width => '20%', align => 'right'  },   
    { key => 'view',  title => '',                               sort => 'none',           width => '5%',  align => 'center' },   
    { key => 'key',   title => '',                               sort => 'none',           width => '2%',  align => 'center' },
    { key => 'type',  title => 'Type',                           sort => 'numeric_hidden', width => '20%'                    },   
    { key => 'desc',  title => 'Description',                    sort => 'none',           width => '53%'                    },
  ];
  
  my (%counts, $total_counts, %ranks, %descriptions, %labels, %colours);
  
  # colour stuff
  my $species_defs = $hub->species_defs;
  my $var_styles   = $species_defs->colour('variation');
  my $colourmap    = $hub->colourmap;
  my @all_cons     = grep $_->feature_class =~ /transcript/i, values %Bio::EnsEMBL::Variation::Utils::Constants::OVERLAP_CONSEQUENCES;
  
  foreach my $con (@all_cons) {
    next if $con->SO_accession =~ /x/i;
    
    my $term = $con->SO_term;
    
    $labels{$term}       = $con->label;
    $descriptions{$term} = $con->description.' <span class="small">(' . $hub->get_ExtURL_link($con->SO_accession, 'SEQUENCE_ONTOLOGY', $con->SO_accession) . ')</span>' unless $descriptions{$term};
    $colours{$term}      = $colourmap->hex_by_name($var_styles->{lc $con->SO_term}->{'default'});
    $ranks{$term}        = $con->rank if $con->rank < $ranks{$term} || !defined $ranks{$term};
  }

  if (!exists($gene_object->__data->{'conscounts'})) {
    # Generate the data the hard way - from all the vfs and tvs
    my (%counts_hash, %total_counts_hash);

    foreach my $tr (@$transcripts) { 
      my $tr_stable_id = $tr->stable_id;
      my $tvs          = $tr->__data->{'transformed'}{'snps'} || {};
      my $gene_snps    = $tr->__data->{'transformed'}{'gene_snps'};
      my $tr_start     = $tr->__data->{'transformed'}{'start'};
      my $tr_end       = $tr->__data->{'transformed'}{'end'};
      my $extent       = $tr->__data->{'transformed'}{'extent'};
      
      foreach (@$gene_snps) {
        my ($snp, $chr, $start, $end) = @$_;
        my $vf_id = $snp->dbID;
        my $tv    = $tvs->{$vf_id};
        
        if ($tv && $end >= $tr_start - $extent && $start <= $tr_end + $extent) {
          foreach my $tva (@{$tv->get_all_alternate_TranscriptVariationAlleles}) {
            foreach my $con (@{$tva->get_all_OverlapConsequences}) {
              my $key  = join '_', $tr_stable_id, $vf_id, $tva->variation_feature_seq;
              my $term = $con->SO_term;
              
              $counts_hash{$term}{$key} = 1 if $con;
              $total_counts_hash{$key}++;
            }
          }
        }
      }
    }
    
    $counts{$_}   = scalar keys %{$counts_hash{$_}} for keys %descriptions;
    $total_counts = scalar keys %total_counts_hash;
  } else {
    # Use the results of the TV count queries
    %counts       = %{$gene_object->__data->{'conscounts'}};
    $total_counts = $counts{'ALL'};
  }
  my $species_name = $hub->species;
  my ($species_name_first, $species_name_second) = split('_', $species_name);
  my $first_letter = lc substr($species_name_first, 0, 1);
  my $mart_species_name = $first_letter . $species_name_second; 
  my $mart_url = $self->hub->species_defs->ENSEMBL_MART_ENABLED ? '/biomart/martview/?VIRTUALSCHEMANAME=default' : '';
  my @mart_attribute_values = ("$mart_species_name\_snp.default.snp.refsnp_id|",
                            "$mart_species_name\_snp.default.snp.refsnp_source|",
                            "$mart_species_name\_snp.default.snp.chr_name|",
                            "$mart_species_name\_snp.default.snp.chrom_start|",
                            "$mart_species_name\_snp.default.snp.validated|",
                            "$mart_species_name\_snp.default.snp.consequence_type_tv|",
                            "$mart_species_name\_snp.default.snp.consequence_allele_string|",
                            "$mart_species_name\_snp.default.snp.ensembl_peptide_allele|",
                            "$mart_species_name\_snp.default.snp.translation_start|",
                            "$mart_species_name\_snp.default.snp.translation_end|",
                            "$mart_species_name\_snp.default.snp.sift_prediction|");
  if ($species_name eq 'Homo_sapiens') {
    push @mart_attribute_values, ("$mart_species_name\_snp.default.snp.minor_allele_freq|", "$mart_species_name\_snp.default.snp.polyphen_prediction|");
  }
  my $mart_attributes =  '&ATTRIBUTES=' . join('', @mart_attribute_values); 
  my $mart_gene_filter = "&FILTERS=$mart_species_name\_snp.default.filters.ensembl_gene.&quot;###GENE_ID###&quot;";
  my $mart_con_type_filter = "|$mart_species_name\_snp.default.filters.so_parent_name.&quot;###SO_TERM###&quot;";
  my $mart_result_panel = '&VISIBLEPANEL=resultspanel';
  my $warning_text = '';
  
  my @rows;
  
  foreach my $con (keys %descriptions) {
    my $colour_block = sprintf '<div style="background-color: %s; width: 10px;">&nbsp;</div>', $colours{$con};
    
    if ($counts{$con}) {
      my $count = $counts{$con};
      my $warning;
      if ($count > 5000) {
        $warning = qq{<span style="color:red;">(WARNING: table may not load for this number of variants!)};
        # optional Biomart link
        if ($hub->species_defs->ENSEMBL_MART_ENABLED) {
          my $gene_id = $gene_object->stable_id;
          $mart_gene_filter =~ s/###GENE_ID###/$gene_id/;
		      $mart_con_type_filter =~ s/###SO_TERM###/$con/;
          my $mart_variation_table_url = join('', $mart_url, $mart_attributes, $mart_gene_filter, $mart_con_type_filter, $mart_result_panel);
          $mart_con_type_filter =~ s/$con/###SO_TERM###/;
          $warning .= qq{ <a href="$mart_variation_table_url">View list in BioMart</a>};
        }
        $warning .= '</span>';
      }

      push @rows, {
        type  => qq{<span class="hidden">$ranks{$con}</span>$labels{$con}},
        desc  => "$descriptions{$con} $warning",
        count => $count,
        view  => $self->ajax_add($self->ajax_url(undef, { sub_table => $con, update_panel => 1 }), $con),
        key   => $colour_block,
      };
    } else {
      push @rows, {
        type  => qq{<span class="hidden">$ranks{$con}</span>$labels{$con}},
        desc  => $descriptions{$con},
        count => 0,
        view  => '-',
        key   => $colour_block,
      };
    }
  }
  
  # add the row for ALL variants if there are any
  if ($total_counts) {
    my $hidden_span = '<span class="hidden">-</span>'; # create a hidden span to add so that ALL is always last in the table
    my $warning = '';
    if ($total_counts > 5000) {
      $warning = qq{<span style="color:red;">(WARNING: table may not load for this number of variants!)};
      # optional Biomart link
      my $gene_id = $gene_object->stable_id;
      if ($hub->species_defs->ENSEMBL_MART_ENABLED) {
        $mart_gene_filter =~ s/###GENE_ID###/$gene_id/;
        my $mart_variation_table_url = join('', $mart_url, $mart_attributes, $mart_gene_filter, $mart_result_panel);
        $warning .= qq{ <a href="$mart_variation_table_url">View list in BioMart</a></span>};
      }
      $warning .= '</span>';
    }
    
    push @rows, {
      type  => $hidden_span . 'ALL',
      view  => $self->ajax_add($self->ajax_url(undef, { sub_table => 'ALL', update_panel => 1 }), 'ALL'),
      desc  => "All variants $warning",
      count => $hidden_span . $total_counts,
    };
  }

  return $self->new_table($columns, \@rows, { data_table => 'no_col_toggle', sorting => [ 'type asc' ], exportable => 0 });
}

sub tree {
  my ($self, $transcripts, $gene_object) = @_;
  my $hub         = $self->hub;
  my $top_SO_term = 'feature_variant'; # define top-level SO term
  my %counts;
  
  if (!exists $gene_object->__data->{'conscounts'}) {
    # Generate the data the hard way - from all the vfs and tvs
    my (%counts_hash, %total_counts_hash);

    foreach my $tr (@$transcripts) { 
      my $tr_stable_id = $tr->stable_id;
      my $tvs          = $tr->__data->{'transformed'}{'snps'} || {};
      my $gene_snps    = $tr->__data->{'transformed'}{'gene_snps'};
      my $tr_start     = $tr->__data->{'transformed'}{'start'};
      my $tr_end       = $tr->__data->{'transformed'}{'end'};
      my $extent       = $tr->__data->{'transformed'}{'extent'};
      
      foreach (@$gene_snps) {
        my ($snp, $chr, $start, $end) = @$_;
        my $vf_id = $snp->dbID;
        my $tv    = $tvs->{$vf_id};
        
        if ($tv && $end >= $tr_start - $extent && $start <= $tr_end + $extent) {
          foreach my $tva (@{$tv->get_all_alternate_TranscriptVariationAlleles}) {
            foreach my $con (@{$tva->get_all_OverlapConsequences}) {
              my $key  = join '_', $tr_stable_id, $vf_id, $tva->variation_feature_seq;
              my $term = $con->SO_term;
              
              $counts_hash{$term}{$key} = 1 if $con;
            }
          }
        }
      }
    }
    
    $counts{$_} = scalar keys %{$counts_hash{$_}} for keys %counts_hash;
  } else {
    %counts = %{$gene_object->__data->{'conscounts'}}; # Use the results of the TV count queries
  }
  
  # get SO tree
  my $tree = $self->get_SO_tree($top_SO_term);
  
  # add counts to tree
  $self->add_counts_to_tree($tree, \%counts);
  
  # add colors
  my $species_defs = $hub->species_defs;
  my $var_styles   = $species_defs->colour('variation');
  my $colourmap    = $hub->colourmap;
  
  $self->add_colours_to_tree($tree, $var_styles, $colourmap);
  
  return sprintf '<ul class="tree variation_consequence_tree">%s</ul>', $self->tree_html($tree, 1);
}

sub variation_table {
  my ($self,$callback,$consequence_type, $transcripts) = @_;
  my $hub         = $self->hub;
  my $show_scores = $hub->param('show_scores');
  my (@rows, $base_trans_url, $url_transcript_prefix, %handles);
  my $num = 0;

  # create some URLs - quicker than calling the url method for every variant
  my $base_url = $hub->url({
    type   => 'Variation',
    action => 'Summary',
    vf     => undef,
    v      => undef,
  });

  # colourmap
  my $var_styles = $hub->species_defs->colour('variation');
  my $colourmap  = $hub->colourmap;
  
  if ($self->isa('EnsEMBL::Web::Component::LRG::VariationTable')) {
    my $gene_stable_id        = $transcripts->[0] && $transcripts->[0]->gene ? $transcripts->[0]->gene->stable_id : undef;
       $url_transcript_prefix = 'lrgt';
    
    my $vfa = $hub->get_adaptor('get_VariationFeatureAdaptor', 'variation');
    
    my @var_ids =
      map $_->{'_variation_id'},
      map $_->[0],
      map @{$_->__data->{'transformed'}{'gene_snps'}},
      @$transcripts;
    
    %handles = %{$vfa->_get_all_subsnp_handles_from_variation_ids(\@var_ids)};
  } else {
    $url_transcript_prefix = 't';
  }

  ROWS: foreach my $transcript (@$transcripts) {
    my %snps = %{$transcript->__data->{'transformed'}{'snps'} || {}};
   
    next unless %snps;
   
    my $transcript_stable_id = $transcript->stable_id;
    my $gene_snps            = $transcript->__data->{'transformed'}{'gene_snps'} || [];
    my $tr_start             = $transcript->__data->{'transformed'}{'start'};
    my $tr_end               = $transcript->__data->{'transformed'}{'end'};
    my $extent               = $transcript->__data->{'transformed'}{'extent'};
    my $gene                 = $transcript->gene;

    foreach (@$gene_snps) {
      my ($snp, $chr, $start, $end) = @$_;
      my $raw_id               = $snp->dbID;
      my $transcript_variation = $snps{$raw_id};
      
      next unless $transcript_variation;
     
      foreach my $tva (@{$transcript_variation->get_all_alternate_TranscriptVariationAlleles}) {
        my $skip = 1;
        
        if ($consequence_type eq 'ALL') {
          $skip = 0;
        } elsif ($tva) {
          foreach my $con (map {$_->SO_term} @{$tva->get_all_OverlapConsequences}) {
            if (grep $con eq $_, split /\,/, $consequence_type) {
              $skip = 0;
              last;
            }
          }
        }
        
        next if $skip;
        
        if ($tva && $end >= $tr_start - $extent && $start <= $tr_end + $extent) {
          my $row;

          my $variation_name = $snp->variation_name;
          my $url = ";vf=$raw_id";
          $row->{'ID'} = $variation_name;
          my $source = $snp->source_name;
          $row->{'Source'} = $source;

          unless($callback->phase eq 'outline') {
            my $evidences            = $snp->get_all_evidence_values || [];
            my $clin_sigs            = $snp->get_all_clinical_significance_states || [];
            my $var_class            = $snp->var_class;
            my $translation_start    = $transcript_variation->translation_start;
            my ($aachange, $aacoord) = $translation_start ? ($tva->pep_allele_string, $translation_start) : ('-', '-');
            my $trans_url            = ";$url_transcript_prefix=$transcript_stable_id";
            my $vf_allele            = $tva->variation_feature_seq;
            my $allele_string        = $snp->allele_string;
            
            # Sort out consequence type string
            my $type = $self->new_consequence_type($tva);
            
            my $sifts = $self->classify_sift_polyphen($tva->sift_prediction,$tva->sift_score);
            my $polys = $self->classify_sift_polyphen($tva->polyphen_prediction, $tva->polyphen_score);
            
            # Adds LSDB/LRG sources
            if ($self->isa('EnsEMBL::Web::Component::LRG::VariationTable')) {
              my $var         = $snp->variation;
              my $syn_sources = $var->get_all_synonym_sources;
              
              foreach my $s_source (@$syn_sources) {
                next if $s_source !~ /LSDB|LRG/;
                
                my ($synonym) = $var->get_all_synonyms($s_source);
                  $source   .= ', ' . $hub->get_ExtURL_link($s_source, $s_source, $synonym);
              }
            }
            
            my $gmaf   = $snp->minor_allele_frequency; # global maf
            my $gmaf_allele;
            if(defined $gmaf) {
              $gmaf = sprintf("%.3f",$gmaf);
              $gmaf_allele = $snp->minor_allele;
            }

            my $status = join('~',@$evidences);
            my $clin_sig = join("~",@$clin_sigs);

            my $transcript_name = ($url_transcript_prefix eq 'lrgt') ? $transcript->Obj->external_name : $transcript_stable_id;
          
            my $more_row = {
              vf         => $raw_id,
              class      => $var_class,
              Alleles    => $allele_string,
              vf_allele  => $vf_allele,
              Ambiguity  => $snp->ambig_code,
              gmaf       => $gmaf   || '-',
              gmaf_allele => $gmaf_allele || '-',
              status     => $status,
              clinsig    => $clin_sig,
              chr        => "$chr:" . ($start > $end ? " between $end & $start" : "$start".($start == $end ? '' : "-$end")),
              location   => "$chr:".($start>$end?$end:$start),
              Submitters => %handles && defined($handles{$snp->{_variation_id}}) ? join(", ", @{$handles{$snp->{_variation_id}}}) : undef,
              snptype    => $type,
              Transcript => $transcript_name,
              aachange   => $aachange,
              aacoord    => $aacoord,
              sift_sort  => $sifts->[0],
              sift_class => $sifts->[1],
              sift_value => $sifts->[2],
              polyphen_sort  => $polys->[0],
              polyphen_class => $polys->[1],
              polyphen_value => $polys->[2],
              HGVS       => $hub->param('hgvs') eq 'on' ? ($self->get_hgvs($tva) || '-') : undef,
            };
            $row = { %$row, %$more_row };
          }
          $num++;
          next unless $callback->passes_muster($row,$num);
          push @rows,$row;
          last ROWS if $callback->stand_down($row,$num);
        }
      }
    }
  }

  return \@rows;
}

sub create_so_term_subsets {
  my $self     = shift;
  my @all_cons = grep $_->feature_class =~ /Bio::EnsEMBL::(Feature|Transcript)/i, values %Bio::EnsEMBL::Variation::Utils::Constants::OVERLAP_CONSEQUENCES;
  my %so_term_subsets;
  
  foreach my $con (@all_cons) {
    next if $con->SO_accession =~ /x/i;
    push @{$so_term_subsets{$con->SO_term}}, $con->SO_term;
  }

  return \%so_term_subsets;
}

sub configure {
  my ($self, $context, $consequence) = @_;
  my $object      = $self->object;
  my $object_type = $self->hub->type;
  my $extent      = $context eq 'FULL' ? 5000 : $context;
  my %cons        = %Bio::EnsEMBL::Variation::Utils::Constants::OVERLAP_CONSEQUENCES;
  my %selected_so = map { $_ => 1 } defined $consequence && $consequence ne 'ALL' ? split /\,/, $consequence : (); # map the selected consequence type to SO terms
  my @so_terms    = keys %selected_so;
  my ($gene_object, $transcript_object);

  if ($object->isa('EnsEMBL::Web::Object::Gene')){ #|| $object->isa('EnsEMBL::Web::Object::LRG')){
    $gene_object = $object;
  } elsif ($object->isa('EnsEMBL::Web::Object::LRG')){
    my @genes   = @{$object->Obj->get_all_Genes('LRG_import')||[]};
    my $gene    = $genes[0];  
    my $factory = $self->builder->create_factory('Gene');
    
    $factory->createObjects($gene);
    
    $gene_object = $factory->object;
  } else {
    $transcript_object = $object;
    $gene_object       = $self->hub->core_object('gene');
  }
  
  $gene_object->get_gene_slices(
    undef,
    [ 'context',     'normal', '100%'  ],
    [ 'gene',        'normal', '33%'   ],
    [ 'transcripts', 'munged', $extent ]
  );
  
  $gene_object->store_TransformedTranscripts; ## Stores in $transcript_object->__data->{'transformed'}{'exons'|'coding_start'|'coding_end'}
 
  my $transcript_slice = $gene_object->__data->{'slices'}{'transcripts'}[1];
  my (undef, $snps)    = $gene_object->getVariationsOnSlice($transcript_slice, $gene_object->__data->{'slices'}{'transcripts'}[2], undef, scalar @so_terms ? \@so_terms : undef);
  my $vf_objs          = [ map $_->[2], @$snps];
  
  # For stats table (no $consquence) without a set intron context ($context). Also don't try for a single transcript (because its slower)
  if (!$consequence && !$transcript_object && $context eq 'FULL') {
    my $so_term_subsets = $self->create_so_term_subsets;
    $gene_object->store_ConsequenceCounts($so_term_subsets, $vf_objs);
  }
  
  # If doing subtable or can't calculate consequence counts
  if ($consequence || !exists($gene_object->__data->{'conscounts'}) || scalar @$vf_objs < 50) {
    $gene_object->store_TransformedSNPS(\@so_terms,$vf_objs); ## Stores in $transcript_object->__data->{'transformed'}{'snps'}
  }
  
  ## Map SNPs for the last SNP display  
  my @gene_snps = map {[
    $_->[2], $transcript_slice->seq_region_name,
    $transcript_slice->strand > 0 ?
      ( $transcript_slice->start + $_->[2]->start - 1, $transcript_slice->start + $_->[2]->end   - 1 ) :
      ( $transcript_slice->end   - $_->[2]->end   + 1, $transcript_slice->end   - $_->[2]->start + 1 )
  ]} @$snps;
  
  foreach (@{$gene_object->get_all_transcripts}) {
    next if $object_type eq 'Transcript' && $_->stable_id ne $self->hub->param('t'); 
    $_->__data->{'transformed'}{'extent'}    = $extent;
    $_->__data->{'transformed'}{'gene_snps'} = \@gene_snps;
  }
  
  return $gene_object;
}

sub get_hgvs {
  my ($self, $tva) = @_;
  my $hgvs_c = $tva->hgvs_coding;
  my $hgvs_p = $tva->hgvs_protein;
  my $hgvs;

  if ($hgvs_c) {
    if (length $hgvs_c > 35) {
      my $display_hgvs_c  = substr($hgvs_c, 0, 35) . '...';
         $display_hgvs_c .= $self->trim_large_string($hgvs_c, 'hgvs_c_' . $tva->dbID);
         $hgvs_c          = $display_hgvs_c;
    }
    
    $hgvs .= $hgvs_c;
  }

  if ($hgvs_p) {
    if (length $hgvs_p > 35) {
      my $display_hgvs_p  = substr($hgvs_p, 0, 35) . '...';
         $display_hgvs_p .= $self->trim_large_string($hgvs_p, 'hgvs_p_'. $tva->dbID);
         $hgvs_p          = $display_hgvs_p;
    }
    
    $hgvs .= "<br />$hgvs_p";
  }
  
  return $hgvs;
}

sub get_SO_tree {
  my ($self, $top_SO_term) = @_;
  my $oa           = $self->hub->get_databases('go')->{'go'}->get_OntologyTermAdaptor;
  my ($top_SO_obj) = @{$oa->fetch_all_by_name($top_SO_term)};
  return $top_SO_obj;
}

sub add_counts_to_tree {
  my ($self, $term_obj, $counts) = @_;
  my $count = 0;
  
  $self->add_counts_to_tree($_, $counts) for @{$term_obj->children};
  
  $term_obj->{'this_count'} = defined $counts->{$term_obj->name} ? $counts->{$term_obj->name} : 0;
  $count += $term_obj->{'this_count'};
  $count += defined $_->{'count'} ? $_->{'count'} : 0 for @{$term_obj->children};
  
  push @{$term_obj->{'term_list'}}, ($term_obj->name, map {@{$_->{'term_list'}}} @{$term_obj->children});
  
  $term_obj->{'count'} = $count;
}

sub add_colours_to_tree {
  my ($self, $term_obj, $var_styles, $colourmap) = @_;
  $term_obj->{'colour'} = $colourmap->hex_by_name($var_styles->{lc $term_obj->name}->{'default'}) if defined $var_styles->{lc $term_obj->name};
  $self->add_colours_to_tree($_, $var_styles, $colourmap) for @{$term_obj->children};
}

sub tree_html {
  my ($self, $term_obj, $last) = @_;
  my $con          = $term_obj->name;
     $con          =~ s/\_/ /g;
     $con          = "\u$con";
     $con          = 'All variants' if $con eq 'Feature variant';
  my %include_cons = map { $_->SO_term => 1 } values %Bio::EnsEMBL::Variation::Utils::Constants::OVERLAP_CONSEQUENCES;
  my @children     = grep $_->{'count'}, @{$term_obj->children};
 
  # don't go further in these cases only
  #undef @children if $term_obj->name =~ /feature.+ation/i;
  my $side_padding = '7px'; #scalar @children ? '7px' : '5px';
  
  my $html = sprintf(
    '<li%s>%s<span title="%s" class="_ht%s">%s%s</span>',
    $last ? ' class="last"' : scalar @children ? ' class="parent top_level"' : '',                                              # last css class
    @children ? '<a href="#" class="toggle open leaf" rel="' . $term_obj->name . '">&nbsp;</a>' : '<img src="/i/leaf.gif" />',  # toggle bit
    (split /\"/, $term_obj->definition)[1],                                                                                     # consequence definition etc
    defined $term_obj->{'colour'} ? '' : ' no_colour',                                                                          # span class
    defined $term_obj->{'colour'} ? qq{<span class="colour" style="background-color:$term_obj->{'colour'}">&nbsp;</span>} : '', # colour block
    $con,                                                                                                                       # name and link
  );
  
  # this term only
  if ($term_obj->{'this_count'} || $term_obj->{'count'}) {
    my $sub_table = scalar @children ? join ',', grep defined $include_cons{$_}, @{$term_obj->{'term_list'}} : $term_obj->name;
    my $link      = $self->ajax_add($self->ajax_url(undef, {
        sub_table    => $sub_table,
        update_panel => 1,
        table_title  => $term_obj->name,
      }),
      $term_obj->name
    );
    
    $html .= sprintf ' | %s (%i)', $link, $term_obj->{'count'};
  }
  
  $html .= ' | <span class="small">' . $self->hub->get_ExtURL_link($term_obj->accession, 'SEQUENCE_ONTOLOGY', $term_obj->accession) . '</span>' unless $con eq 'All variants';
  
  my $warning_text = $term_obj->{'count'} > 10000 ? qq{<span style="color:red;">(WARNING: table may not load for this number of variants!)</span>} : '';

  $html .= " $warning_text";

  # iterate  
  if (scalar @children) {
    @children = sort {
      ($b->name =~ /stream/) <=> ($a->name =~ /stream/) ||
      scalar @{$a->children} <=> scalar @{$b->children}
    } @children;
    
    $html .= sprintf '<div class="%s" ><ul class="toggleable">', $term_obj->name;
    
    for (my $i = 0; $i < scalar @children; $i++) {
      $html .= $self->tree_html($children[$i], $i + 1 == scalar @children ? 1 : 0);
    }
    
    $html .= '</ul></div>';
  }
  
  $html .= '</li>';
  
  return $html;
}

1;
