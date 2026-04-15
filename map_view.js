document.addEventListener("DOMContentLoaded", () => {
const menuContainer = document.getElementById("dynamic-populated-menu");

window.dataCataloguePromise.then(data => {
  // Drop the "UV radiation" key from key "Physico-Chemical" in the dataCatalogue for the map view
  console.log("Original dataCatalogue keys:", Object.keys(data));
  if (data["Physico-Chemical"]) {
    delete data["Physico-Chemical"]["UV radiation"];
  }
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
          const categoryItems = dataCatalogue[category][subcategory].filter(item => item.Project === "Expanse" && item.show_on_map === true);
          if (categoryItems.length === 0) {
            continue;
          }

            const subLi = document.createElement("li");
            const subA = document.createElement("a");
            subA.href = "javascript:void(0)";
            subA.textContent = subcategory.replace(/_/g, " ");
            subLi.appendChild(subA);

            const itemsUl = document.createElement("ul");
          categoryItems.forEach(item => {

                const itemLi = document.createElement("li");
                const productItem = document.createElement("div");
                productItem.classList.add("product-item");

                const itemA = document.createElement("a");
                itemA.textContent = item.Title;
                itemA.itemData = item;

                const metadataIcon = document.createElement("span");
                metadataIcon.classList.add("metadata-icon");
                metadataIcon.innerHTML = "&#9432;";

                metadataIcon.addEventListener("click", () => {
                    const metadataBox = document.getElementById("metadata-box");
                    const metadataContent = document.getElementById("metadata-content");

                    // Clear previous content
                    metadataContent.innerHTML = "";

                    ["Title",
                      "Surface ID",
                      "Category",
                      "Theme",
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
                    const distanceFromRight = window.innerWidth - sidebarRect.left;
                    metadataBox.style.right = `${distanceFromRight}px`
                    metadataBox.style.left = "auto";

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

        if (subUl.children.length > 0) {
          categoryLi.appendChild(subUl);
          container.appendChild(categoryLi);
        }
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

function parseChooseableDate(value) {
  if (!value || typeof value !== "string") return null;

  const trimmedValue = value.trim();
  const parseFormats = ["d-m-Y", "j-n-Y", "d-m-y", "j-n-y"];

  for (const format of parseFormats) {
    const parsedDate = flatpickr.parseDate(trimmedValue, format);
    if (parsedDate) return parsedDate;
  }

  return null;
}

function extractYear(value) {
  const match = String(value || "").match(/(\d{4})(?!.*\d{4})/);
  return match ? match[1] : "";
}

function normalizeMonthlyValue(value) {
  const parsedDate = parseChooseableDate(value);
  if (!parsedDate) return null;

  const year = parsedDate.getFullYear();
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}-01`;
}

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
      // 31-12-2020
      options.dateFormat = "d-m-Y";
      options.altFormat = "d_m_Y";
      options.minDate = parseChooseableDate(item.start_time);
      options.maxDate = parseChooseableDate(item.end_time);
      const chooseableDates = item.chooseable_in_map.split(",")
        .map(parseChooseableDate)
        .filter(Boolean);
      console.log("Chooseable dates:", chooseableDates);
      options.enable = chooseableDates;
      options.theme = "dark";
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
        // dateFormat: "M-Y",
        altFormat: "m_Y",
        theme: "dark"
      })];
      options.minDate = normalizeMonthlyValue(item.start_time);
      options.maxDate = normalizeMonthlyValue(item.end_time);
      // options.enable = ["2020-01-01", "2020-06-01", "2020-12-01"]

      const chooseableMonths = item.chooseable_in_map.split(",")
        .map(normalizeMonthlyValue)
        .filter(Boolean);
      console.log("Chooseable months:", chooseableMonths);
      options.enable = chooseableMonths;

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

      if (item.available && item.available.length > 0) {
        const years = item.available.split(",").map(y => y.trim());
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

        const startYear = parseInt(extractYear(start_time));
        const endYear = parseInt(extractYear(end_time));

        for (let year = startYear; year <= endYear; year++) {
          const option = document.createElement("option");
          option.classList.add("year_option");
          option.value = year;
          option.textContent = year;
          select.appendChild(option);
        }
      }

      if (item.chooseable_in_map.length > 0) {
        const chooseable_in_map = item.chooseable_in_map.split(",").map(y => y.trim());
        const options = select.querySelectorAll("option.year_option");
        options.forEach(option => { 
          if (!chooseable_in_map.some(dateValue => extractYear(dateValue) === option.value)) {
            option.disabled = true;
            // And make it visually clear that it's disabled
            option.style.color = "#929292"; // light gray background
            // Make the font not bold and smaller to indicate it's not selectable
            option.style.fontWeight = "normal";
          }
        });
      }

      if (lastSelected) select.value = lastSelected;
      select.addEventListener("change", () => {
        window.selectedDate = select.value;
      });

      timeControls.appendChild(select);
      break;
    } // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

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

function positionMapWidgets() {
    const sidebar = document.getElementById("sidebar");
    const sidebarWidth = sidebar.offsetWidth;
    const sidebarRightOffset = 5; 

    const slider = document.querySelector(".slider-container");
    slider.style.right = `${sidebarWidth + sidebarRightOffset + 12}px`;

    const projection_note = document.querySelector(".projection_note");
    projection_note.style.right = `${sidebarWidth + sidebarRightOffset + 12}px`;

    const layerSwitcher = document.querySelector(".leaflet-control-layers.leaflet-control-layers-expanded.leaflet-control");
    layerSwitcher.style.right = `${sidebarWidth + sidebarRightOffset + 4}px`;
}

// positionMapWidgets()

document.getElementById("metadata-close").addEventListener("click", () => {
    document.getElementById("metadata-box").classList.add("hidden");
});

var toggleButton = document.getElementById("sidebar-toggle");
toggleButton.addEventListener("click", function(event) {
    event.currentTarget.classList.toggle("change");
    var sidebar = document.querySelector("#sidebar");
    sidebar.classList.toggle("open");
});

positionMapWidgets();

toggleButton.addEventListener("click", function(event) {
    event.currentTarget.classList.toggle("change");
    var sidebar_img1 = document.querySelector("#sidebar-img1");
    var sidebar_img2 = document.querySelector("#sidebar-img2");
    var metadataBox = document.querySelector("#metadata-box");
    sidebar_img1.classList.toggle("open");
    sidebar_img2.classList.toggle("open");

    // Toggle only if the metadata box is currently open
    if (!metadataBox.classList.contains("hidden")) {
    metadataBox.classList.toggle("hidden");
    }
    setTimeout(positionMapWidgets, 310);
});

});






