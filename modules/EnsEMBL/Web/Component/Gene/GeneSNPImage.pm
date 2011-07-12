# $Id$

package EnsEMBL::Web::Component::Gene::GeneSNPImage;

use strict;

use base qw(EnsEMBL::Web::Component::Gene);

sub _init {
  my $self = shift;
  $self->cacheable(0);
  $self->ajaxable(1);
}

sub content {
  my $self        = shift;
  my $no_snps     = shift;
  my $ic_type     = shift || 'GeneSNPView';
  my $hub         = $self->hub;
  my $object      = $self->object;
  my $image_width = $self->image_width     || 800;  
  my $context     = $hub->param('context') || 100; 
  my $extent      = $context eq 'FULL' ? 1000 : $context;
  my @confs       = qw(gene transcripts_top transcripts_bottom);
  my ($image_configs, $snp_counts);
  
  # Padding
  # Get 4 configs - and set width to width of context config
  # Get two slice -  gene (4/3x) transcripts (+/-extent)
  
  push @confs, 'snps' unless $no_snps;  

  foreach (@confs) {
    $image_configs->{$_} = $hub->get_imageconfig($_ eq 'gene' ? $ic_type : 'GeneSNPView', $_);
    $image_configs->{$_}->set_parameters({
      image_width => $image_width, 
      context     => $context
    });
  }
  
  $object->get_gene_slices(
    $image_configs->{'gene'},
    [ 'gene',        'normal', '33%'   ],
    [ 'transcripts', 'munged', $extent ]
  );
  
  my $transcript_slice = $object->__data->{'slices'}{'transcripts'}[1]; 
  my $sub_slices       = $object->__data->{'slices'}{'transcripts'}[2];  

  # Fake SNPs
  # Grab the SNPs and map them to subslice co-ordinate
  # $snps contains an array of array each sub-array contains [fake_start, fake_end, B:E:Variation object] # Stores in $object->__data->{'SNPS'}
  my ($count_snps, $snps, $context_count) = $object->getVariationsOnSlice($transcript_slice, $sub_slices);  
  my $start_difference   = $object->__data->{'slices'}{'transcripts'}[1]->start - $object->__data->{'slices'}{'gene'}[1]->start;
  my @fake_filtered_snps = map [ $_->[2]->start + $start_difference, $_->[2]->end + $start_difference, $_->[2] ], @$snps;
  my @domain_logic_names = qw(Pfam scanprosite Prints pfscan PrositePatterns PrositeProfiles Tigrfam Superfamily Smart PIRSF);
  
  $image_configs->{'gene'}->{'filtered_fake_snps'} = \@fake_filtered_snps unless $no_snps;
  
  # Make fake transcripts
  $object->store_TransformedTranscripts;                            # Stores in $transcript_object->__data->{'transformed'}{'exons'|'coding_start'|'coding_end'}
  $object->store_TransformedDomains($_) for @domain_logic_names;    # Stores in $transcript_object->__data->{'transformed'}{'Pfam_hits'}
  $object->store_TransformedSNPS unless $no_snps;                   # Stores in $transcript_object->__data->{'transformed'}{'snps'}


  # This is where we do the configuration of containers
  my (@transcripts, @containers_and_configs);

  # sort so trancsripts are displayed in same order as in transcript selector table  
  my $strand = $object->Obj->strand;
  my @trans  = @{$object->get_all_transcripts};
  my @sorted_trans;
  
  if ($strand == 1) {
    @sorted_trans = sort { $b->Obj->external_name cmp $a->Obj->external_name || $b->Obj->stable_id cmp $a->Obj->stable_id } @trans;
  } else {
    @sorted_trans = sort { $a->Obj->external_name cmp $b->Obj->external_name || $a->Obj->stable_id cmp $b->Obj->stable_id } @trans;
  } 

  foreach my $trans_obj (@sorted_trans) {
    my $image_config = $hub->get_imageconfig($ic_type, $trans_obj->stable_id);
    $image_config->init_transcript;
    
    # create config and store information on it
    $trans_obj->__data->{'transformed'}{'extent'} = $extent;
    
    $image_config->{'geneid'}      = $object->stable_id;
    $image_config->{'snps'}        = $snps unless $no_snps;
    $image_config->{'subslices'}   = $sub_slices;
    $image_config->{'extent'}      = $extent;
    $image_config->{'_add_labels'} = 1;
    
    # Store transcript information on config
    my $transformed_slice = $trans_obj->__data->{'transformed'};

    $image_config->{'transcript'} = {
      exons        => $transformed_slice->{'exons'},
      coding_start => $transformed_slice->{'coding_start'},
      coding_end   => $transformed_slice->{'coding_end'},
      transcript   => $trans_obj->Obj,
      gene         => $object->Obj
    };
    
    $image_config->{'transcript'}{'snps'} = $transformed_slice->{'snps'} unless $no_snps;
    
    # Turn on track associated with this db/logic name
    $image_config->modify_configs(
      [ $image_config->get_track_key('gsv_transcript', $object) ],
      { display => 'normal', show_labels => 'off', caption => '' }
    );

    $image_config->{'transcript'}{lc($_) . '_hits'} = $transformed_slice->{lc($_) . '_hits'} for @domain_logic_names;
    $image_config->set_parameters({ container_width => $object->__data->{'slices'}{'transcripts'}[3] });

    if ($object->seq_region_strand < 0) {
      push @containers_and_configs, $transcript_slice, $image_config;
    } else {
      unshift @containers_and_configs, $transcript_slice, $image_config; # If forward strand we have to draw these in reverse order (as forced on -ve strand)
    }
    
    push @transcripts, { exons => $transformed_slice->{'exons'} };
  }
  
  # Map SNPs for the last SNP display
  my $snp_rel     = 5;  # relative length of snp to gap in bottom display
  my $fake_length = -1; # end of last drawn snp on bottom display
  my $slice_trans = $transcript_slice;

  # map snps to fake evenly spaced co-ordinates
  my @snps2;
  
  if (!$no_snps) {
    foreach (sort { $a->[0] <=> $b->[0] } @$snps) {
      $fake_length += $snp_rel + 1;
      
      push @snps2, [
        $fake_length - $snp_rel + 1, 
        $fake_length,
        $_->[2], 
        $slice_trans->seq_region_name,
        $slice_trans->strand > 0 ? (
          $slice_trans->start + $_->[2]->start - 1,
          $slice_trans->start + $_->[2]->end   - 1
        ) : (
          $slice_trans->end - $_->[2]->end   + 1,
          $slice_trans->end - $_->[2]->start + 1
        )
      ];
    }
    
    $_->__data->{'transformed'}{'gene_snps'} = \@snps2 for @{$object->get_all_transcripts}; # Cache data so that it can be retrieved later
  }

  # Tweak the configurations for the five sub images
  # Gene context block;
  my $gene_stable_id = $object->stable_id;

  # Transcript block
  $image_configs->{'gene'}->{'geneid'} = $gene_stable_id; 
  $image_configs->{'gene'}->set_parameters({ container_width => $object->__data->{'slices'}{'gene'}[1]->length }); 
  $image_configs->{'gene'}->modify_configs(
    [ $image_configs->{'gene'}->get_track_key('transcript', $object) ],
    { display => 'transcript_nolabel', menu => 'no' }  
  );
 
  # Intronless transcript top and bottom (to draw snps, ruler and exon backgrounds)
 foreach(qw(transcripts_top transcripts_bottom)) {
   $image_configs->{$_}->{'extent'}      = $extent;
   $image_configs->{$_}->{'geneid'}      = $gene_stable_id;
   $image_configs->{$_}->{'transcripts'} = \@transcripts;
   $image_configs->{$_}->{'snps'}        = $object->__data->{'SNPS'} unless $no_snps;
   $image_configs->{$_}->{'subslices'}   = $sub_slices;
   $image_configs->{$_}->{'fakeslice'}   = 1;
   $image_configs->{$_}->set_parameters({ container_width => $object->__data->{'slices'}{'transcripts'}[3] }); 
 }
  
  $image_configs->{'transcripts_bottom'}->get_node('spacer')->set('display', 'off') if $no_snps;
  
  # SNP box track
  if (!$no_snps) {
    $image_configs->{'snps'}->{'fakeslice'}  = 1;
    $image_configs->{'snps'}->{'snps'}       = \@snps2;
    $image_configs->{'snps'}->set_parameters({ container_width => $fake_length }); 
    $snp_counts = [ $count_snps, scalar @$snps, $context_count ];
  }

  # Render image
  my $image = $self->new_image([
      $object->__data->{'slices'}{'gene'}[1], $image_configs->{'gene'},
      $transcript_slice, $image_configs->{'transcripts_top'},
      @containers_and_configs,
      $transcript_slice, $image_configs->{'transcripts_bottom'},
      $no_snps ? () : ($transcript_slice, $image_configs->{'snps'})
    ],
    [ $object->stable_id ]
  );
  
  return if $self->_export_image($image, 'no_text');

  $image->imagemap         = 'yes';
  $image->{'panel_number'} = 'top';
  $image->set_button( 'drag', 'title' => 'Drag to select region' );
  
  my $html = $image->render; 
  
  if ($no_snps) {
    $html .= $self->_info(
      'Configuring the display',
      "<p>Tip: use the '<strong>Configure this page</strong>' link on the left to customise the protein domains displayed above.</p>"
    );
    return $html;
  }
  
  my $info_text = $self->config_info($snp_counts);
  
  $html .= $self->_info(
    'Configuring the display',
    qq{
    <p>
      Tip: use the '<strong>Configure this page</strong>' link on the left to customise the protein domains and types of variations displayed above.<br />
      Please note the default 'Context' settings will probably filter out some intronic SNPs.<br />
      $info_text
    </p>}
  );
  
  return $html;
}

sub config_info {
  my ($self, $counts) = @_;
  
  return unless ref $counts eq 'ARRAY';
  
  my $info;
  
  if ($counts->[0] == 0) {
    $info = 'There are no SNPs within the context selected for this transcript.';
  } elsif ($counts->[1] == 0) {
    $info = "The options set in the page configuration have filtered out all $counts->[0] variations in this region.";
  } elsif ($counts->[0] == $counts->[1]) {
    $info = 'None of the variations are filtered out by the Source, Class and Type filters.';
  } else {
    $info = ($counts->[0] - $counts->[1]) . " of the $counts->[0] variations in this region have been filtered out by the Source, Class and Type filters.";
  }
  
  return $info unless defined $counts->[2]; # Context filter
  
  $info .= '<br />';
  
  if ($counts->[2]== 0) {
    $info .= 'None of the intronic variations are removed by the Context filter.';
  } elsif ($counts->[2] == 1) {
    $info .= "$counts->[2] intronic variation has been removed by the Context filter.";
  } else {
    $info .= "$counts->[2] intronic variations are removed by the Context filter.";
  }
  
  return $info;
}

1;

