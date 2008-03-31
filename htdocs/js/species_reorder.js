var performedSave = 0;

function toggle_reorder() {
  if (document.getElementById('reorder_species').style.display == 'none') {
    document.getElementById('reorder_species').style.display = 'block';
    document.getElementById('full_species').style.display = 'none';
  } else {
    document.getElementById('full_species').style.display = 'block';
    document.getElementById('reorder_species').style.display = 'none';
  }
}

function update_species(element) {
  //alert(element.id);
  if (!performedSave) {
    performedSave = 1;
    var url = "/common/user/save_favourites";
    var data = "favourites=" + serialize('favourites_list');
    data = data + "&list=" + serialize('species_list');
    var prepare = new Ajax.Request(url,
                         { method: 'get', parameters: data, onComplete: saved });
  }
}

function saved(response) {
  document.getElementById('full_species').innerHTML = response.responseText;
  performedSave = 0;
}

function serialize(element) {
  // Based on Sortable.serialize from Scriptaculous
  var items = $(element).childNodes;
  var queryComponents = new Array();
  for(var i=0; i<items.length; i++) {
    queryComponents.push(items[i].id.split("_")[1]);
  }
  return queryComponents.join(",");
}

Sortable.create('species_list', {"onUpdate":update_species, containment:["species_list","favourites_list"], dropOnEmpty:false});
Sortable.create('favourites_list', {"onUpdate":update_species, containment:["species_list","favourites_list"], dropOnEmpty:false});

