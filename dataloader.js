window.dataCataloguePromise = fetch("metadata.json")
  .then(response => response.json())
  .then(data => {
    window.dataCatalogue = data;
    return data;
  });


// define function to convert terms of the json into other terms 
function initMenu(dataCatalogue, container) {
    for (const category in dataCatalogue) {
        // --- Category level ---
        const categoryLi = document.createElement("li");
    }
  }
  