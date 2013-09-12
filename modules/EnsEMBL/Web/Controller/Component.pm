# $Id$

package EnsEMBL::Web::Controller::Component;

### Prints the dynamically created components. Loaded either via AJAX (if available) or parallel HTTP requests.

use strict;

use base qw(EnsEMBL::Web::Controller);

sub page_type { return 'Component'; }
sub cacheable { return 1;           }
sub request   { return $_[0]{'request'} ||= $_[0]->species_defs->OBJECT_TO_SCRIPT->{$_[0]->hub->type} eq 'Modal' ? 'modal' : undef; }

sub init {
  my $self = shift;
  
  return if $self->get_cached_content('component'); # Page retrieved from cache
  
  my $hub     = $self->hub;
  my $referer = $hub->referer;
  
  # Set action of component to be the same as the action of the referer page - needed for view configs to be correctly created
  $hub->action = $ENV{'ENSEMBL_ACTION'} = $hub->param('force_action') || $referer->{'ENSEMBL_ACTION'};
  
  if (!$ENV{'ENSEMBL_FUNCTION'}) {
    $hub->function = $ENV{'ENSEMBL_FUNCTION'} = $hub->param('force_function') || $referer->{'ENSEMBL_FUNCTION'};
  }
  
  $self->builder->create_objects;
  $self->page->initialize; # Adds the components to be rendered to the page module
  
  my $object = $self->object;
  
  if ($object) {
    $object->__data->{'_action'}   = $ENV{'ENSEMBL_ACTION'};
    $object->__data->{'_function'} = $ENV{'ENSEMBL_FUNCTION'};
  }
  
  if ($hub->user) {
    my $hash_change = $hub->param('hash_change');
    $self->update_user_history($hash_change) if $hash_change;
  }
  
  $self->configure;
  $self->render_page;
}

1;
