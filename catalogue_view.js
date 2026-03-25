const menuContainerCatalogue = document.getElementById("dynamic-populated-menu-catalogue-view");

window.dataCataloguePromise.then(data => {
    initMenu(data, menuContainerCatalogue);
});

function initMenu(dataCatalogue, container) {
    for (const category in dataCatalogue) {
        // --- Category level ---
        const categoryLi = document.createElement("li");
        categoryLi.classList.add("category");

        const categoryA = document.createElement("a");
        categoryA.href = "javascript:void(0)";
        categoryA.innerHTML = `<span>${category.replace(/_/g, " ")}</span>`;
        categoryLi.appendChild(categoryA);

        const subUl = document.createElement("ul");
        for (const subcategory in dataCatalogue[category]) {
            const subLi = document.createElement("li");
            subLi.classList.add("subcategory");

            const subA = document.createElement("a");
            subA.href = "javascript:void(0)";
            subA.textContent = subcategory.replace(/_/g, " ");
            subLi.appendChild(subA);

            subA.addEventListener("click", (e) => {
                e.stopPropagation();
                container.querySelectorAll(".subcategory a.selected").forEach(a => a.classList.remove("selected"));
                subA.classList.add("selected");
                let subcategoryItems = dataCatalogue[category][subcategory];
                // Overwrite subcategoryItems that have a unique catalogue_page
                const uniqueCataloguePages = new Map();
                subcategoryItems.forEach(item => {
                    if (item.catalogue_page) {
                        uniqueCataloguePages.set(item.catalogue_page, item);
                    }
                });
                subcategoryItems = Array.from(uniqueCataloguePages.values());

                openCataloguePanel(subcategoryItems);
                document.getElementById("OpenDataButton").classList.add("inactive");
                document.getElementById("OpenDataButton").classList.remove("active");
                document.getElementById("catalogue-panel").classList.remove("no-grid");
            });

            subUl.appendChild(subLi);
        }
        categoryLi.appendChild(subUl);
        container.appendChild(categoryLi);
    }
}

// Toggle submenus on category click
$(document).on("click", "#dynamic-populated-menu-catalogue-view > li.category", function (e) {
    const subUl = $(this).children("ul");
    if (subUl.length === 0) return;

    e.preventDefault();
    subUl.slideToggle();                 // Toggle this category
    $(this).siblings().children("ul").slideUp(); // Close siblings
});

// Build catalogue panel content
function openCataloguePanel(subcategoryItems) {
    const cataloguePanel = document.getElementById("catalogue-panel");
    cataloguePanel.innerHTML = ""; // clear previous content

    subcategoryItems.forEach(item => {
        const itemDiv = document.createElement("div");
        itemDiv.classList.add("catalogue-item");
        
        // Content (keys/values aligned)
        const contentDiv = document.createElement("div");
        contentDiv.classList.add("catalogue-item-content");

        // Add Thumbnail image <img src="images\ExposomeNL_logo_1320x320_noborder.png" alt="ExposomeNL logo" class="sidebar-img1">
        const thumbnail = document.createElement("img");
        // thumbnail.src = item.thumbnail;
        const basePath = "/catalogue_pages/images/thumbnails/";
        thumbnail.onerror = function () {
            this.onerror = null;
            this.src = `${basePath}not_available.png`;
        };

        thumbnail.src = `${basePath}${item.thumbnail}.png`;
        thumbnail.classList.add("catalogue-item-thumbnail");
        contentDiv.appendChild(thumbnail);
        
        // Title
        const titleDiv = document.createElement("a");
        titleDiv.classList.add("catalogue-item-title");
        const displayTitle = item.catalogue_page ? item.catalogue_page.replace(/_/g, " ") : item.id || "No Title";

        titleDiv.textContent = displayTitle;
        titleDiv.href = "/catalogue_pages/" + item.catalogue_page + ".html";
        titleDiv.target = "_blank";
        titleDiv.rel = "noopener noreferrer";

        contentDiv.appendChild(titleDiv);

        itemDiv.appendChild(contentDiv);
        cataloguePanel.appendChild(itemDiv);
    });
}

const openDataContent = `
<div class="open-data-container">

    <div class="open-data-intro">
        <h2>Open Exposome Data</h2>
        <p>Exposome studies frequently use openly available datasets to explore the interactions
        between environmental exposures and health outcomes, or as inputs for the modeling of more complex exposures.
        We provide a selection of open datasets that have been used in Expanse and ExposomeNL studies, 
        and data platforms that provide access to exposome-related data.</p>
    </div>

    <h3>Datasets</h3>
    <table class="resources-table">
        <colgroup>
            <col style="width: 15%">
            <col style="width: 35%">
            <col style="width: 30%">
            <col style="width: 8%">
            <col style="width: 12%">
        </colgroup>
        <tr>
            <th>Dataset</th>
            <th>Description</th>
            <th>Source</th>
            <th>Link</th>
            <th>Spatial extent</th>
        </tr>
        <tr>
            <td>Species diversity</td>
            <td>Species diversity per kilometer</td>
            <td>Nationale Databank Flora & Fauna (Nationaal Georegister)</td>
            <td><a href="https://nationaalgeoregister.nl/geonetwork/srv/dut/catalog.search#/metadata/22833e30-8815-4b41-9af1-2a6b99b75130" target="_blank" rel="noopener noreferrer">Link</a></td>
            <td>Netherlands</td>
        </tr>
        <tr>
            <td>Urban heat island effect</td>
            <td>Temperature difference between the city and the countryside</td>
            <td>Atlas Natuurlijk Kapitaal (Nationaal Georegister)</td>
            <td><a href="https://nationaalgeoregister.nl/geonetwork/srv/dut/catalog.search#/metadata/c9aa9109-3f32-4f65-84e5-bb1c9ebdfbec" target="_blank" rel="noopener noreferrer">Link</a></td>
            <td>Netherlands</td>
        </tr>
        <tr>
            <td>Methane CH4</td>
            <td>Atmospheric CH4 observations derived from satellite radiances</td>
            <td>Copernicus Browser</td>
            <td><a href="https://browser.dataspace.copernicus.eu/?zoom=5&lat=50.16282&lng=20.78613&themeId=DEFAULT-THEME&demSource3D=%22MAPZEN%22&cloudCoverage=30&dateMode=SINGLE" target="_blank" rel="noopener noreferrer">Link</a></td>
            <td>Global</td>
        </tr>
        <tr>
            <td>National noise level</td>
            <td>Calculated noise exposure</td>
            <td>National Institute for Public Health and the Environment (Nationaal Georegister)</td>
            <td><a href="https://www.nationaalgeoregister.nl/geonetwork/srv/api/records/68711fca-7589-4b83-829c-42550803c287" target="_blank" rel="noopener noreferrer">Link</a></td>
            <td>Netherlands</td>
        </tr>
        <tr>
            <td>Light intensity at night</td>
            <td>Remote sensing nighttime lights composites from VIIRS</td>
            <td>Earth Observation Group, Payne Institute</td>
            <td><a href="https://eogdata.mines.edu/products/vnl/#introduction" target="_blank" rel="noopener noreferrer">Link</a></td>
            <td>Global</td>
        </tr>
    </table>

    <h3>Data Platforms</h3>
    <table class="resources-table">
        <colgroup>
            <col style="width: 15%">
            <col style="width: 35%">
            <col style="width: 30%">
            <col style="width: 8%">
            <col style="width: 12%">
        </colgroup>
        <tr>
            <th>Data platform</th>
            <th>Description</th>
            <th>Source</th>
            <th>Link</th>
            <th>Spatial extent</th>
        </tr>
        <tr>
            <td>Climate Data Store</td>
            <td>Data catalogue containing datasets about Earth's past, present and future climate</td>
            <td>Copernicus Climate Change Service (C3S)</td>
            <td><a href="https://cds.climate.copernicus.eu/datasets" target="_blank" rel="noopener noreferrer">Link</a></td>
            <td>Global</td>
        </tr>
        <tr>
            <td>Atlas of the Living Environment (Atlas Leefomgeving)</td>
            <td>Data catalogue and informational site containing datasets related to environmental themes in the Netherlands</td>
            <td>Atlas Leefomgeving</td>
            <td><a href="https://www.atlasleefomgeving.nl/" target="_blank" rel="noopener noreferrer">Link</a></td>
            <td>Netherlands</td>
        </tr>
    </table>

</div>
`;

document.getElementById("OpenDataButton").addEventListener("click", function () {
    const cataloguePanel = document.getElementById("catalogue-panel");
    cataloguePanel.innerHTML = openDataContent; // display open data content
    cataloguePanel.classList.add("no-grid");
    document.querySelectorAll("#dynamic-populated-menu-catalogue-view .subcategory a.selected")
        .forEach(a => a.classList.remove("selected"));
    this.classList.add("active");
    document.getElementById("OpenDataButton").classList.remove("inactive");
});