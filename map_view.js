document.addEventListener("DOMContentLoaded", () => {
const menuContainer = document.getElementById("dynamic-populated-menu");

window.dataCataloguePromise.then(data => {
  initMenu(data, menuContainer);
});

function initMenu(dataCatalogue, container) {
    for (const category in dataCatalogue) {
        const categoryLi = document.createElement("li");
        categoryLi.classList.add("sub-menu");

        const categoryA = document.createElement("a");
        categoryA.href = "javascript:void(0)";
        categoryA.innerHTML = `<span>${category.replace(/_/g, " ")}</span>`;
        categoryLi.appendChild(categoryA);

        const subUl = document.createElement("ul");
        for (const subcategory in dataCatalogue[category]) {
            const subLi = document.createElement("li");
            const subA = document.createElement("a");
            subA.href = "javascript:void(0)";
            subA.textContent = subcategory.replace(/_/g, " ");
            subLi.appendChild(subA);

            const itemsUl = document.createElement("ul");
            dataCatalogue[category][subcategory].forEach(item => {
                if (item.show_on_map !== true) return;

                const itemLi = document.createElement("li");
                const productItem = document.createElement("div");
                productItem.classList.add("product-item");

                const itemA = document.createElement("a");
                itemA.textContent = item.Description;
                itemA.itemData = item;

                const metadataIcon = document.createElement("span");
                metadataIcon.classList.add("metadata-icon");
                metadataIcon.innerHTML = "&#9432;";

                metadataIcon.addEventListener("click", () => {
                    const metadataBox = document.getElementById("metadata-box");
                    const metadataContent = document.getElementById("metadata-content");

                    // Clear previous content
                    metadataContent.innerHTML = "";

                    ["Category",
                      "Theme",
                      "Description",
                      "Summary",
                      "File type",
                      "Temporal resolution",
                      "Time period",
                      "Frequency",
                      "Spatial resolution",
                      "Extent",
                      "Unit",
                      "CRS",
                      "No-data value",
                      "Owner",
                      "Comments"].forEach(key => {
                        if (item[key]) {
                            const row = document.createElement("div");
                            row.className = "metadata-row";

                            const keyEl = document.createElement("span");
                            keyEl.className = "metadata-key";
                            keyEl.textContent = key;

                            const valueEl = document.createElement("span");
                            valueEl.className = "metadata-value";
                            valueEl.textContent = item[key];

                            row.appendChild(keyEl);
                            row.appendChild(valueEl);
                            metadataContent.appendChild(row);
                        }
                    });

                    // Position the metadata box to the right of the sidebar
                    const sidebar = document.getElementById("sidebar");
                    const sidebarRect = sidebar.getBoundingClientRect();
                    metadataBox.style.left = `${sidebarRect.right}px`;

                    metadataBox.classList.remove("hidden");
                });

                productItem.appendChild(itemA);
                productItem.appendChild(metadataIcon);
                itemLi.appendChild(productItem);
                itemsUl.appendChild(itemLi);
            });

            subLi.appendChild(itemsUl);
            subUl.appendChild(subLi);
        }

        categoryLi.appendChild(subUl);
        container.appendChild(categoryLi);
    }
}
// Toggle submenus on click
$(document).on("click", "#leftside-navigation li > a", function (e) {
  const nextUl = $(this).next("ul");
  if (nextUl.length === 0) return; // No submenu, do nothing

  e.preventDefault();

  // Toggle only the clicked submenu
  nextUl.slideToggle();

  // Optionally, close sibling submenus at the same level
  $(this).parent().siblings().find("ul").slideUp();

  e.stopPropagation();
});

menuContainer.addEventListener("click", function(e) {
  const target = e.target;

  if (target.tagName === "A" && target.itemData) {
    e.stopPropagation();

    menuContainer.querySelectorAll("a.selected").forEach(a => a.classList.remove("selected"));
    target.classList.add("selected");

    // Store globally
    window.selectedItem = target.itemData;
    window.dispatchEvent(
    new CustomEvent("itemSelected", { detail: window.selectedItem })
    
    );
    display_time_component(window.selectedItem);
  }
});
// Return info about the selected product
function getSelectedItem() {
  const selected = menuContainer.querySelector("a.selected");
  return selected ? selected.itemData : null;
}

const item = getSelectedItem();
if (item) {
  console.log(item.id, item.description, item.file_type);
}

const dateInput = document.getElementById("datePicker");

function display_time_component(item) {
  if (!item || !item["Temporal resolution"]) {
    console.warn("Item or temporal resolution missing");
    return;
  }

  const timeControls = document.querySelector(".time-controls");
  timeControls.innerHTML = ""; // Clear previous picker

  const lastSelected = window.selectedDate || null;

  let options = {
    onChange: function(selectedDates, dateStr) {
      window.selectedDate = dateStr;
    }
  };

  switch (item["Temporal resolution"]) {
    // Add a listener to update window.selectedDate when a date is picked
    case "Daily": {
      const input = document.createElement("input");
      input.id = "datePicker";
      input.type = "text";
      input.placeholder = "Select a date";
      timeControls.appendChild(input);

      options.dateFormat = "d-M-Y";
      options.altFormat = "d_m_Y";
      options.minDate = item.start_time;
      options.maxDate = item.end_time;
      if (lastSelected) options.defaultDate = lastSelected;

      flatpickr(input, options);
      break;
    }

    case "Monthly": {
      const input = document.createElement("input");
      input.id = "datePicker";
      input.type = "text";
      input.placeholder = "Select a month";
      timeControls.appendChild(input);

      // Add a listener to update window.selectedDate when a month is picked
      options.plugins = [new monthSelectPlugin({
        shorthand: true,
        dateFormat: "M-Y",
        altFormat: "m_Y",
        theme: "dark"
      })];
      options.minDate = item.start_time;
      options.maxDate = item.end_time;
      if (lastSelected) options.defaultDate = lastSelected;
      flatpickr(input, options);
      break;
    }

    case "Annual": {
      const select = document.createElement("select");
      select.classList.add("year-select");
      select.id = "yearPicker";

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "Select a year";
      emptyOption.disabled = true;
      emptyOption.selected = true;
      select.appendChild(emptyOption);

      if (item.available_years && item.available_years.length > 0) {
        const years = item.available_years.split(",").map(y => y.trim());
        years.forEach(year => {
          const option = document.createElement("option");
          option.classList.add("year_option");
          option.value = year;
          option.textContent = year;
          select.appendChild(option);
        });
      }
      else {
        const start_time = item.start_time;
        const end_time = item.end_time;

        const startYear = parseInt(start_time.split("_")[2]);
        const endYear = parseInt(end_time.split("_")[2]);

        for (let year = startYear; year <= endYear; year++) {
          const option = document.createElement("option");
          option.classList.add("year_option");
          option.value = year;
          option.textContent = year;
          select.appendChild(option);
        }
      }

      if (lastSelected) select.value = lastSelected;
      select.addEventListener("change", () => {
        window.selectedDate = select.value;
      });

      timeControls.appendChild(select);
      break;
    }

    default:
      console.log("Unknown temporal_resolution:", item["Temporal resolution"]);
      break;
  }
  setupShowOnMapListener();
}

function setupShowOnMapListener() {
  const showOnMapBtn = document.getElementById("showOnMapBtn");
  const picker = document.querySelector(".time-controls input, .time-controls select");

  if (!picker) return;

  showOnMapBtn.disabled = !picker.value;

  picker.addEventListener("change", function() {
    showOnMapBtn.disabled = !picker.value;
  });
}

document.getElementById("metadata-close").addEventListener("click", () => {
    document.getElementById("metadata-box").classList.add("hidden");
});

var toggleButton = document.getElementById("sidebar-toggle");
toggleButton.addEventListener("click", function(event) {
    event.currentTarget.classList.toggle("change");
    var sidebar = document.querySelector("#sidebar");
    sidebar.classList.toggle("open");
});
});






