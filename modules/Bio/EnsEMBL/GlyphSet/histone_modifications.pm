package Bio::EnsEMBL::GlyphSet::histone_modifications;
use strict;
use vars qw(@ISA);
use Bio::EnsEMBL::GlyphSet;
use Bio::EnsEMBL::GlyphSet::wiggle_and_block;
use Sanger::Graphics::Glyph::Text;
use Sanger::Graphics::Glyph::Rect;
use Bio::EnsEMBL::Utils::Eprof qw(eprof_start eprof_end eprof_dump); 
@ISA = qw(Bio::EnsEMBL::GlyphSet::wiggle_and_block);
use Data::Dumper;

sub get_block_features {

  ### block_features

  my ( $self, $db ) = @_;
  unless ( $self->{'block_features'} ) {
    my $feature_adaptor = $db->get_DataSetAdaptor();
    if (!$feature_adaptor) {
      warn ("Cannot get get adaptors: $feature_adaptor");
      return [];
    }
    my $features = $feature_adaptor->fetch_all_displayable() || [] ;
    $self->{'block_features'} = $features;
  }

  my $colour = "blue";
  return ( $self->{'block_features'}, $colour);
}


sub draw_features {

  ### Description: gets features for block features and passes to render_block_features
  ### Draws wiggles if wiggle flag is 1
  ### Returns 1 if draws blocks. Returns 0 if no blocks drawn

  my ($self, $db, $wiggle)= @_;
  my ($block_features, $colour) = $self->get_block_features($db);
  my $drawn_flag = 0;
  my $drawn_wiggle_flag = 0;
  my $slice = $self->{'container'};
  my $wiggle_colour = "contigblue1";
  foreach my $feature ( @$block_features ) {

    # render wiggle if wiggle
    if ($wiggle) {
      foreach my $result_set  (  @{ $feature->get_displayable_ResultSets() } ){   
	#get features for slice and experimtenal chip set
	my @features = @{ $result_set->get_displayable_ResultFeatures_by_Slice($slice) };
	next unless @features;
	
	$drawn_wiggle_flag = "wiggle";
	@features   = sort { $a->score <=> $b->score  } @features;
	my ($min_score, $max_score) = ($features[0]->score || 0, $features[-1]->score|| 0);
	$self->render_wiggle_plot(\@features, $wiggle_colour, $min_score, $max_score, $result_set->display_label);
      }
      $self->render_space_glyph() if $drawn_wiggle_flag;
    }

    # Block features
    foreach my $fset ( @{ $feature->get_displayable_FeatureSets() }){
      my $display_label = $fset->display_label();
      my $features = $fset->get_PredictedFeatures_by_Slice($slice ) ;
      next unless @$features;
      $drawn_flag = "block_features";
      $self->render_block_features( $features, $colour );
      $self->render_track_name($display_label, $colour);
    }
  }

  $self->render_space_glyph() if $drawn_flag;
  return ($drawn_flag, $drawn_wiggle_flag);
}


sub block_features_zmenu {

  ### Predicted features
  ### Creates zmenu for predicted features track
  ### Arg1: arrayref of Feature objects

  my ($self, $f ) = @_;
  my $offset = $self->{'container'}->strand > 0 ? $self->{'container'}->start - 1 :  $self->{'container'}->end + 1;
  my $pos =  ($offset + $f->start )."-".($f->end+$offset);
  my $score = sprintf("%.3f", $f->score());
  my %zmenu = ( 
    'caption'               => ($f->display_label || ''),
    "03:bp:   $pos"       => '',
    "05:description: ".($f->feature_type->description() || '-') => '',
    "06:analysis:    ".($f->analysis->display_label() || '-')  => '',
    "09:score: ".$score => '',
  );
  return \%zmenu || {};
}


1;
### Contact: Fiona Cunningham fc1@sanger.ac.uk
