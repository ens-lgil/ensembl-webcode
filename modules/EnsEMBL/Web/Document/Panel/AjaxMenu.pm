package EnsEMBL::Web::Document::Panel::AjaxMenu;

use strict;
use Data::Dumper qw(Dumper);
use CGI qw(escapeHTML);

use base qw(EnsEMBL::Web::Document::Panel);

sub _start {
  my $self = shift;
}

sub _end   { 
  my $self = shift;
}

sub add_entry {
  my( $self, $type, $label, $link, $priority, $extra ) = @_;
  $self->{'entries'} ||= [];
  push @{$self->{'entries'}}, {
    'type'     => $type,
    'label'    => $label,
    'link'     => $link,
    'priority' => $priority || 100,
    'extra'    => $extra||{} 
  };
}

sub content {
  my $self = shift;
  $self->print('
<tbody class="real">');
  $self->printf('
  <tr>
    <th class="caption" colspan="2">%s</th>
  </tr>', escapeHTML($self->{'caption'}) );
  foreach my $entry ( sort { $b->{'priority'} <=> $a->{'priority'} || $a->{'label'} cmp $b->{'label'} } @{$self->{'entries'}||[]} ) {
    my $txt = escapeHTML( $entry->{'label'} );
    if( $entry->{'link'} ) {
      $txt = sprintf( '<a href="%s"%s>%s</a>',
        escapeHTML($entry->{'link'}),
	$entry->{'extra'}{'external'} ? ' rel="external"' : '',
	$txt
      );
    }
    if( $entry->{'type'} ) {
      $self->printf( '
  <tr>
    <th>%s</th>
    <td>%s</td>
  </tr>', escapeHTML($entry->{'type'}), $txt );
    } else {
      $self->printf( '
  <tr>
    <td colspan="2">%s</td>
  </tr>', $txt );
    }
  }
  $self->print('
</tbody>');
}

sub render {
  my( $self, $first ) = @_;
  $self->content();
}

sub _error {
  my( $self, $caption, $body ) = @_;
  $self->add_entry( 
    "$caption: $body" 
  );
}

1;
