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
