// ============================================
// SALES DASHBOARD
// Google Sheet → GitHub Dashboard
// ============================================

const CSV_URL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vQkx61LU5M5w6cafCI36sVjmFbBZ5lK2krxwI-uxLsblvc0RBX5YHk7C9iKFbQvYM9RAcFQwYcuIdkn/pub?gid=1181069336&single=true&output=csv";

let allData = [];
let charts = {};


// ============================================
// LOAD GOOGLE SHEET
// ============================================

async function loadData() {

    try {

        const response = await fetch(CSV_URL);

        if (!response.ok) {
            throw new Error("Google Sheet data load nahi hua.");
        }

        const csvText = await response.text();

        allData = parseCSV(csvText);

        console.log("Google Sheet Data:", allData);

        setupFilters();

        updateDashboard();

    } catch (error) {

        console.error(error);

        alert(
            "Google Sheet se data load nahi ho pa raha hai. " +
            "Please Google Sheet ka Published CSV link check karein."
        );
    }
}


// ============================================
// CSV PARSER
// ============================================

function parseCSV(text) {

    const rows = [];
    let row = [];
    let value = "";
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {

        const char = text[i];
        const next = text[i + 1];

        if (char === '"' && insideQuotes && next === '"') {

            value += '"';
            i++;

        } else if (char === '"') {

            insideQuotes = !insideQuotes;

        } else if (char === "," && !insideQuotes) {

            row.push(value.trim());
            value = "";

        } else if ((char === "\n" || char === "\r") && !insideQuotes) {

            if (char === "\r" && next === "\n") {
                i++;
            }

            row.push(value.trim());

            if (row.some(x => x !== "")) {
                rows.push(row);
            }

            row = [];
            value = "";

        } else {

            value += char;
        }
    }

    if (value !== "" || row.length > 0) {

        row.push(value.trim());

        if (row.some(x => x !== "")) {
            rows.push(row);
        }
    }

    if (rows.length === 0) {
        return [];
    }

    const headers = rows[0].map(h => h.trim());

    return rows.slice(1).map(row => {

        const obj = {};

        headers.forEach((header, index) => {
            obj[header] = row[index] || "";
        });

        return obj;
    });
}


// ============================================
// FILTER SETUP
// ============================================

function setupFilters() {

    const filters = {

        typeFilter: "TYPE",
        agentFilter: "AGENT NAME",
        brandFilter: "BRAND NAME",
        dealerFilter: "DEALER NAME",
        monthFilter: "MONTH",
        yearFilter: "YEAR",
        quarterFilter: "FY Quarter",
        fyFilter: "F YEAR",
        seasonFilter: "SEASON"

    };

    Object.keys(filters).forEach(filterId => {

        const columnName = filters[filterId];

        const select = document.getElementById(filterId);

        if (!select) return;

        const values = [...new Set(

            allData
                .map(row => row[columnName])
                .filter(value => value !== undefined && value !== "")

        )];

        values.sort((a, b) =>
            String(a).localeCompare(String(b), undefined, {
                numeric: true
            })
        );

        select.innerHTML = "";

        const defaultOption = document.createElement("option");

        defaultOption.value = "";
        defaultOption.textContent = "All " + columnName;

        select.appendChild(defaultOption);

        values.forEach(value => {

            const option = document.createElement("option");

            option.value = value;
            option.textContent = value;

            select.appendChild(option);
        });

        select.addEventListener("change", updateDashboard);
    });
}


// ============================================
// APPLY FILTERS
// ============================================

function getFilteredData() {

    const filterMap = {

        "TYPE": document.getElementById("typeFilter").value,

        "AGENT NAME":
            document.getElementById("agentFilter").value,

        "BRAND NAME":
            document.getElementById("brandFilter").value,

        "DEALER NAME":
            document.getElementById("dealerFilter").value,

        "MONTH":
            document.getElementById("monthFilter").value,

        "YEAR":
            document.getElementById("yearFilter").value,

        "FY Quarter":
            document.getElementById("quarterFilter").value,

        "F YEAR":
            document.getElementById("fyFilter").value,

        "SEASON":
            document.getElementById("seasonFilter").value
    };

    return allData.filter(row => {

        return Object.keys(filterMap).every(column => {

            const selectedValue = filterMap[column];

            if (!selectedValue) {
                return true;
            }

            return String(row[column]).trim() ===
                   String(selectedValue).trim();
        });

    });
}


// ============================================
// NUMBER CONVERSION
// ============================================

function numberValue(value) {

    if (value === undefined || value === null) {
        return 0;
    }

    let cleaned = String(value)
        .replace(/₹/g, "")
        .replace(/,/g, "")
        .replace(/\s/g, "")
        .trim();

    const number = parseFloat(cleaned);

    return isNaN(number) ? 0 : number;
}


// ============================================
// DASHBOARD UPDATE
// ============================================

function updateDashboard() {

    const data = getFilteredData();

    updateKPIs(data);

    updateBrandChart(data);

    updateMonthChart(data);

    updateAgentChart(data);

    updateDealerChart(data);
}


// ============================================
// KPI CARDS
// ============================================

function updateKPIs(data) {

    const totalValue = data.reduce(

        (sum, row) =>
            sum + numberValue(row["VALUE"]),

        0
    );


    const totalQty = data.reduce(

        (sum, row) =>
            sum + numberValue(row["QTY"]),

        0
    );


    const invoices = new Set(

        data
            .map(row => row["INVOICE NO"])
            .filter(value => value !== "")

    );


    const dealers = new Set(

        data
            .map(row => row["DEALER NAME"])
            .filter(value => value !== "")

    );


    document.getElementById("totalValue").textContent =
        formatCurrency(totalValue);


    document.getElementById("totalQty").textContent =
        formatNumber(totalQty);


    document.getElementById("totalInvoices").textContent =
        formatNumber(invoices.size);


    document.getElementById("totalDealers").textContent =
        formatNumber(dealers.size);
}


// ============================================
// CURRENCY FORMAT
// ============================================

function formatCurrency(value) {

    if (value >= 10000000) {

        return "₹ " +
            (value / 10000000).toFixed(2) +
            " Cr";

    }

    if (value >= 100000) {

        return "₹ " +
            (value / 100000).toFixed(2) +
            " L";

    }

    return "₹ " +
        value.toLocaleString("en-IN", {
            maximumFractionDigits: 0
        });
}


// ============================================
// NUMBER FORMAT
// ============================================

function formatNumber(value) {

    return Number(value).toLocaleString("en-IN", {
        maximumFractionDigits: 0
    });
}


// ============================================
// GROUP DATA
// ============================================

function groupBy(data, column) {

    const result = {};

    data.forEach(row => {

        const key =
            row[column] || "Blank";

        if (!result[key]) {
            result[key] = 0;
        }

        result[key] += numberValue(row["VALUE"]);
    });

    return result;
}


// ============================================
// CREATE / UPDATE CHART
// ============================================

function drawChart(

    chartId,
    type,
    labels,
    values,
    title

) {

    const canvas =
        document.getElementById(chartId);

    if (!canvas) return;


    if (charts[chartId]) {

        charts[chartId].destroy();
    }


    charts[chartId] = new Chart(canvas, {

        type: type,

        data: {

            labels: labels,

            datasets: [{

                label: "Value",

                data: values,

                borderWidth: 2,

                borderRadius: 5,

                tension: 0.3

            }]
        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {

                legend: {
                    display: false
                },

                tooltip: {

                    callbacks: {

                        label: function(context) {

                            return "₹ " +
                                context.raw.toLocaleString("en-IN");
                        }
                    }
                }
            },

            scales: {

                y: {

                    beginAtZero: true,

                    ticks: {

                        callback: function(value) {

                            if (value >= 10000000) {
                                return "₹ " +
                                    (value / 10000000).toFixed(1) +
                                    " Cr";
                            }

                            if (value >= 100000) {
                                return "₹ " +
                                    (value / 100000).toFixed(1) +
                                    " L";
                            }

                            return "₹ " +
                                value.toLocaleString("en-IN");
                        }
                    }
                }
            }
        }
    });
}


// ============================================
// BRAND CHART
// ============================================

function updateBrandChart(data) {

    const grouped =
        groupBy(data, "BRAND NAME");


    const sorted =
        Object.entries(grouped)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);


    drawChart(

        "brandChart",

        "bar",

        sorted.map(x => x[0]),

        sorted.map(x => x[1]),

        "Brand Wise Value"

    );
}


// ============================================
// MONTH CHART
// ============================================

function updateMonthChart(data) {

    const grouped =
        groupBy(data, "MONTH");


    const entries =
        Object.entries(grouped);


    drawChart(

        "monthChart",

        "line",

        entries.map(x => x[0]),

        entries.map(x => x[1]),

        "Month Wise Value"

    );
}


// ============================================
// AGENT CHART
// ============================================

function updateAgentChart(data) {

    const grouped =
        groupBy(data, "AGENT NAME");


    const sorted =
        Object.entries(grouped)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);


    drawChart(

        "agentChart",

        "bar",

        sorted.map(x => x[0]),

        sorted.map(x => x[1]),

        "Agent Wise Value"

    );
}


// ============================================
// DEALER CHART
// ============================================

function updateDealerChart(data) {

    const grouped =
        groupBy(data, "DEALER NAME");


    const sorted =
        Object.entries(grouped)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);


    drawChart(

        "dealerChart",

        "bar",

        sorted.map(x => x[0]),

        sorted.map(x => x[1]),

        "Dealer Wise Value"

    );
}


// ============================================
// START DASHBOARD
// ============================================

loadData();

// ============================================================
// DASHBOARD 2
// Brand / Dealer / Type / FY Multi Select
// Last 3 Financial Year Comparison
// ============================================================

let d2Data = [];
let d2Headers = [];

let d2Selected = {
    fy: new Set(),
    type: new Set(),
    brand: new Set(),
    dealer: new Set()
};


// ============================================================
// DASHBOARD SWITCH
// ============================================================

function showDashboard(number) {

    const dashboard1 = document.getElementById("dashboard1");
    const dashboard2 = document.getElementById("dashboard2");

    const tabs = document.querySelectorAll(".dash-tab");

    if (number === 1) {

        if (dashboard1)
            dashboard1.style.display = "block";

        if (dashboard2)
            dashboard2.style.display = "none";

        if (tabs[0])
            tabs[0].classList.add("active");

        if (tabs[1])
            tabs[1].classList.remove("active");

    } else {

        if (dashboard1)
            dashboard1.style.display = "none";

        if (dashboard2)
            dashboard2.style.display = "block";

        if (tabs[0])
            tabs[0].classList.remove("active");

        if (tabs[1])
            tabs[1].classList.add("active");

        if (!d2Data.length) {
            loadDashboard2();
        }
    }
}


// ============================================================
// MULTI SELECT OPEN / CLOSE
// ============================================================

function toggleMulti(id) {

    const box = document.getElementById(id);

    if (!box) return;

    document.querySelectorAll(".multi-select").forEach(item => {

        if (item !== box) {
            item.classList.remove("open");
        }

    });

    box.classList.toggle("open");
}


document.addEventListener("click", function(event) {

    if (!event.target.closest(".multi-select")) {

        document.querySelectorAll(".multi-select")
            .forEach(item => {
                item.classList.remove("open");
            });

    }

});


// ============================================================
// FIND COLUMN
// ============================================================

function d2FindColumn(names) {

    const normalizedHeaders = d2Headers.map(header =>

        String(header)
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "")

    );


    for (const name of names) {

        const searchName =
            String(name)
                .toLowerCase()
                .replace(/[^a-z0-9]/g, "");


        const index =
            normalizedHeaders.indexOf(searchName);


        if (index !== -1) {

            return d2Headers[index];

        }

    }

    return "";

}


// ============================================================
// CSV PARSER
// ============================================================

function d2ParseCSV(text) {

    const rows = [];

    let row = [];
    let value = "";
    let insideQuotes = false;


    for (let i = 0; i < text.length; i++) {

        const char = text[i];
        const next = text[i + 1];


        if (
            char === '"' &&
            insideQuotes &&
            next === '"'
        ) {

            value += '"';
            i++;


        } else if (char === '"') {

            insideQuotes = !insideQuotes;


        } else if (
            char === "," &&
            !insideQuotes
        ) {

            row.push(value.trim());
            value = "";


        } else if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {

            if (
                char === "\r" &&
                next === "\n"
            ) {
                i++;
            }


            row.push(value.trim());


            if (row.some(x => x !== "")) {
                rows.push(row);
            }


            row = [];
            value = "";


        } else {

            value += char;

        }

    }


    if (
        value !== "" ||
        row.length > 0
    ) {

        row.push(value.trim());

        if (row.some(x => x !== "")) {
            rows.push(row);
        }

    }


    return rows;

}


// ============================================================
// NUMBER
// ============================================================

function d2Number(value) {

    if (
        value === undefined ||
        value === null ||
        value === ""
    ) {
        return 0;
    }


    const cleaned =
        String(value)
            .replace(/₹/g, "")
            .replace(/,/g, "")
            .replace(/\s/g, "")
            .trim();


    const number = parseFloat(cleaned);


    return isNaN(number)
        ? 0
        : number;

}


// ============================================================
// MONEY
// ============================================================

function d2Money(value) {

    value = Number(value) || 0;


    if (value >= 10000000) {

        return "₹ " +
            (value / 10000000).toFixed(2) +
            " Cr";

    }


    if (value >= 100000) {

        return "₹ " +
            (value / 100000).toFixed(2) +
            " L";

    }


    return "₹ " +
        value.toLocaleString("en-IN", {
            maximumFractionDigits: 0
        });

}


// ============================================================
// PERCENTAGE
// ============================================================

function d2Percent(value) {

    return (
        Number(value) || 0
    ).toFixed(2) + "%";

}


// ============================================================
// DATE
// ============================================================

function d2Date(value) {

    if (!value)
        return null;


    const text =
        String(value).trim();


    let match =
        text.match(
            /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
        );


    let date;


    if (match) {

        date = new Date(
            Number(match[3]),
            Number(match[2]) - 1,
            Number(match[1])
        );

    } else {

        date = new Date(text);

    }


    return isNaN(date)
        ? null
        : date;

}


// ============================================================
// FINANCIAL YEAR
// ============================================================

function d2FinancialYear(row) {

    const fyColumn =
        d2FindColumn([
            "F YEAR",
            "FY",
            "Financial Year"
        ]);


    if (
        fyColumn &&
        row[fyColumn]
    ) {

        return String(
            row[fyColumn]
        ).trim();

    }


    const dateColumn =
        d2FindColumn([
            "DATE",
            "Invoice Date",
            "Sales Date"
        ]);


    if (!dateColumn)
        return "";


    const date =
        d2Date(row[dateColumn]);


    if (!date)
        return "";


    const year =
        date.getFullYear();


    const month =
        date.getMonth() + 1;


    if (month >= 4) {

        return (
            year +
            "-" +
            String(year + 1).slice(-2)
        );

    }


    return (
        (year - 1) +
        "-" +
        String(year).slice(-2)
    );

}


// ============================================================
// FILTER VALUES
// ============================================================

function d2GetValues(type) {

    if (type === "fy") {

        return [
            ...new Set(
                d2Data
                    .map(row =>
                        d2FinancialYear(row)
                    )
                    .filter(Boolean)
            )
        ].sort().reverse();

    }


    const columnMap = {

        type: [
            "TYPE"
        ],

        brand: [
            "BRAND NAME",
            "BRAND"
        ],

        dealer: [
            "DEALER NAME",
            "DEALER"
        ]

    };


    const column =
        d2FindColumn(
            columnMap[type]
        );


    if (!column)
        return [];


    return [
        ...new Set(

            d2Data
                .map(row =>
                    String(
                        row[column] || ""
                    ).trim()
                )
                .filter(Boolean)

        )
    ].sort();

}


// ============================================================
// CREATE MULTI SELECT
// ============================================================

function d2SetupMulti(
    type,
    elementId
) {

    const root =
        document.getElementById(
            elementId
        );


    if (!root)
        return;


    const menu =
        root.querySelector(
            ".multi-menu"
        );


    const button =
        root.querySelector(
            "button"
        );


    const values =
        d2GetValues(type);


    menu.innerHTML = "";


    values.forEach(value => {

        const label =
            document.createElement(
                "label"
            );


        const checkbox =
            document.createElement(
                "input"
            );


        checkbox.type = "checkbox";
        checkbox.value = value;


        label.appendChild(
            checkbox
        );


        label.appendChild(
            document.createTextNode(
                " " + value
            )
        );


        checkbox.addEventListener(
            "change",
            function() {

                d2Selected[type] =
                    new Set(

                        [
                            ...menu.querySelectorAll(
                                "input:checked"
                            )
                        ].map(
                            item => item.value
                        )

                    );


                button.textContent =
                    d2Selected[type].size
                        ? d2Selected[type].size +
                          " Selected ▾"
                        : "All " +
                          type.toUpperCase() +
                          " ▾";


                d2Update();

            }
        );


        menu.appendChild(label);

    });

}


// ============================================================
// FILTER DATA
// ============================================================

function d2FilteredRows() {

    const fromValue =
        document.getElementById(
            "d2-from"
        )?.value;


    const toValue =
        document.getElementById(
            "d2-to"
        )?.value;


    const fromDate =
        fromValue
            ? new Date(fromValue)
            : null;


    const toDate =
        toValue
            ? new Date(
                toValue +
                "T23:59:59"
            )
            : null;


    const typeColumn =
        d2FindColumn([
            "TYPE"
        ]);


    const brandColumn =
        d2FindColumn([
            "BRAND NAME",
            "BRAND"
        ]);


    const dealerColumn =
        d2FindColumn([
            "DEALER NAME",
            "DEALER"
        ]);


    const dateColumn =
        d2FindColumn([
            "DATE",
            "Invoice Date",
            "Sales Date"
        ]);


    return d2Data.filter(row => {


        const fy =
            d2FinancialYear(row);


        if (
            d2Selected.fy.size &&
            !d2Selected.fy.has(fy)
        ) {
            return false;
        }


        if (
            d2Selected.type.size &&
            !d2Selected.type.has(
                String(
                    row[typeColumn] || ""
                ).trim()
            )
        ) {
            return false;
        }


        if (
            d2Selected.brand.size &&
            !d2Selected.brand.has(
                String(
                    row[brandColumn] || ""
                ).trim()
            )
        ) {
            return false;
        }


        if (
            d2Selected.dealer.size &&
            !d2Selected.dealer.has(
                String(
                    row[dealerColumn] || ""
                ).trim()
            )
        ) {
            return false;
        }


        if (
            fromDate ||
            toDate
        ) {

            const date =
                dateColumn
                    ? d2Date(
                        row[dateColumn]
                    )
                    : null;


            if (!date)
                return false;


            if (
                fromDate &&
                date < fromDate
            ) {
                return false;
            }


            if (
                toDate &&
                date > toDate
            ) {
                return false;
            }

        }


        return true;

    });

}


// ============================================================
// KPI
// ============================================================

function d2UpdateKPI(rows) {

    const targetColumn =
        d2FindColumn([
            "TARGET",
            "TARGET VALUE",
            "FY TARGET",
            "TARGET VALUE"
        ]);


    const saleColumn =
        d2FindColumn([
            "VALUE",
            "SALE VALUE",
            "SALES VALUE"
        ]);


    const returnColumn =
        d2FindColumn([
            "RETURN VALUE",
            "RETURN",
            "RETURNS"
        ]);


    const dealerColumn =
        d2FindColumn([
            "DEALER NAME",
            "DEALER"
        ]);


    let target = 0;
    let sales = 0;
    let returns = 0;


    const dealers =
        new Set();


    rows.forEach(row => {

        target +=
            d2Number(
                row[targetColumn]
            );


        sales +=
            d2Number(
                row[saleColumn]
            );


        returns +=
            d2Number(
                row[returnColumn]
            );


        if (
            row[dealerColumn]
        ) {

            dealers.add(
                row[dealerColumn]
            );

        }

    });


    const net =
        sales - returns;


    const achievement =
        target
            ? (net / target) * 100
            : 0;


    const returnPercent =
        sales
            ? (returns / sales) * 100
            : 0;


    const targetEl =
        document.getElementById(
            "d2-target"
        );


    const salesEl =
        document.getElementById(
            "d2-sales"
        );


    const returnEl =
        document.getElementById(
            "d2-return"
        );


    const netEl =
        document.getElementById(
            "d2-net"
        );


    const achieveEl =
        document.getElementById(
            "d2-achieve"
        );


    const returnPctEl =
        document.getElementById(
            "d2-return-pct"
        );


    const dealersEl =
        document.getElementById(
            "d2-dealers"
        );


    if (targetEl)
        targetEl.textContent =
            d2Money(target);


    if (salesEl)
        salesEl.textContent =
            d2Money(sales);


    if (returnEl)
        returnEl.textContent =
            d2Money(returns);


    if (netEl)
        netEl.textContent =
            d2Money(net);


    if (achieveEl)
        achieveEl.textContent =
            d2Percent(
                achievement
            );


    if (returnPctEl)
        returnPctEl.textContent =
            d2Percent(
                returnPercent
            );


    if (dealersEl)
        dealersEl.textContent =
            dealers.size.toLocaleString(
                "en-IN"
            );

}


// ============================================================
// TABLE
// ============================================================

function d2BuildTable(rows) {

    const table =
        document.getElementById(
            "dashboard2-table"
        );


    if (!table)
        return;


    const brandColumn =
        d2FindColumn([
            "BRAND NAME",
            "BRAND"
        ]);


    const targetColumn =
        d2FindColumn([
            "TARGET",
            "TARGET VALUE",
            "FY TARGET"
        ]);


    const valueColumn =
        d2FindColumn([
            "VALUE",
            "SALE VALUE",
            "SALES VALUE"
        ]);


    const returnColumn =
        d2FindColumn([
            "RETURN VALUE",
            "RETURN"
        ]);


    const qtyColumn =
        d2FindColumn([
            "QTY",
            "QUANTITY",
            "NET QTY"
        ]);


    let years = [
        ...new Set(
            rows
                .map(row =>
                    d2FinancialYear(row)
                )
                .filter(Boolean)
        )
    ];


    years.sort(
        (a, b) =>
            String(b).localeCompare(
                String(a),
                undefined,
                {
                    numeric: true
                }
            )
    );


    years =
        years.slice(0, 3);


    const groups = {};


    rows.forEach(row => {

        const brand =
            String(
                row[brandColumn] || ""
            ).trim();


        const fy =
            d2FinancialYear(row);


        if (!brand || !fy)
            return;


        const key =
            brand + "|" + fy;


        if (!groups[key]) {

            groups[key] = {

                target: 0,

                qty: 0,

                net: 0

            };

        }


        groups[key].target +=
            d2Number(
                row[targetColumn]
            );


        groups[key].qty +=
            d2Number(
                row[qtyColumn]
            );


        groups[key].net +=
            d2Number(
                row[valueColumn]
            ) -
            d2Number(
                row[returnColumn]
            );

    });


    const brands = [
        ...new Set(

            rows
                .map(row =>
                    String(
                        row[brandColumn] || ""
                    ).trim()
                )
                .filter(Boolean)

        )
    ].sort();


    let html = "";


    // HEADER ROW 1

    html += "<thead>";

    html += "<tr>";

    html += `
        <th rowspan="2">
            BRAND NAME
        </th>
    `;


    years.forEach(year => {

        html += `
            <th colspan="4">
                ${year}
            </th>
        `;

    });


    html += `
        <th colspan="2">
            GROWTH %
        </th>
    `;


    html += "</tr>";


    // HEADER ROW 2

    html += "<tr>";


    years.forEach(() => {

        html += `
            <th>TARGET</th>
            <th>NET QTY</th>
            <th>NET VALUE</th>
            <th>ACHIEVE %</th>
        `;

    });


    html += `
        <th>CY vs PY</th>
        <th>PY vs 2Y AGO</th>
    `;


    html += "</tr>";

    html += "</thead>";


    // BODY

    html += "<tbody>";


    brands.forEach(brand => {

        const values = [];


        years.forEach(year => {

            const key =
                brand + "|" + year;


            values.push(
                groups[key] || {

                    target: 0,

                    qty: 0,

                    net: 0

                }
            );

        });


        html += `
            <tr>

                <td>
                    ${brand}
                </td>
        `;


        values.forEach(item => {

            const achieve =
                item.target
                    ? (
                        item.net /
                        item.target
                    ) * 100
                    : 0;


            html += `

                <td>
                    ${d2Money(
                        item.target
                    )}
                </td>


                <td>
                    ${Math.round(
                        item.qty
                    ).toLocaleString(
                        "en-IN"
                    )}
                </td>


                <td>
                    ${d2Money(
                        item.net
                    )}
                </td>


                <td>
                    ${d2Percent(
                        achieve
                    )}
                </td>

            `;

        });


        let growth1 = null;
        let growth2 = null;


        if (
            values.length >= 2 &&
            values[1].net !== 0
        ) {

            growth1 =
                (
                    (
                        values[0].net -
                        values[1].net
                    )
                    /
                    Math.abs(
                        values[1].net
                    )
                ) * 100;

        }


        if (
            values.length >= 3 &&
            values[2].net !== 0
        ) {

            growth2 =
                (
                    (
                        values[1].net -
                        values[2].net
                    )
                    /
                    Math.abs(
                        values[2].net
                    )
                ) * 100;

        }


        html += `

            <td class="${d2GrowthClass(growth1)}">

                ${d2Growth(growth1)}

            </td>


            <td class="${d2GrowthClass(growth2)}">

                ${d2Growth(growth2)}

            </td>


            </tr>

        `;

    });


    html += "</tbody>";


    table.innerHTML = html;

}


// ============================================================
// GROWTH
// ============================================================

function d2Growth(value) {

    if (value === null)
        return "—";


    return d2Percent(value) +
        (
            value >= 0
                ? " ↑"
                : " ↓"
        );

}


function d2GrowthClass(value) {

    if (value === null)
        return "";


    return value >= 0
        ? "growth-positive"
        : "growth-negative";

}


// ============================================================
// UPDATE DASHBOARD 2
// ============================================================

function d2Update() {

    const rows =
        d2FilteredRows();


    d2UpdateKPI(rows);

    d2BuildTable(rows);

}


// ============================================================
// LOAD DASHBOARD 2
// ============================================================

async function loadDashboard2() {

    try {

        const response =
            await fetch(
                CSV_URL + "&t=" +
                Date.now()
            );


        if (!response.ok) {

            throw new Error(
                "Google Sheet load failed"
            );

        }


        const csvText =
            await response.text();


        const parsed =
            d2ParseCSV(csvText);


        if (!parsed.length)
            return;


        d2Headers =
            parsed.shift();


        d2Data =
            parsed.map(row => {

                const object = {};


                d2Headers.forEach(
                    (header, index) => {

                        object[header] =
                            row[index] || "";

                    }
                );


                return object;

            });


        // FILTERS

        d2SetupMulti(
            "fy",
            "d2-fy"
        );


        d2SetupMulti(
            "type",
            "d2-type"
        );


        d2SetupMulti(
            "brand",
            "d2-brand"
        );


        d2SetupMulti(
            "dealer",
            "d2-dealer"
        );


        // DATE FILTERS

        const fromDate =
            document.getElementById(
                "d2-from"
            );


        const toDate =
            document.getElementById(
                "d2-to"
            );


        if (fromDate) {

            fromDate.addEventListener(
                "change",
                d2Update
            );

        }


        if (toDate) {

            toDate.addEventListener(
                "change",
                d2Update
            );

        }


        d2Update();


    } catch (error) {

        console.error(
            "Dashboard 2 Error:",
            error
        );


        alert(
            "Dashboard 2 ka Google Sheet data load nahi hua."
        );

    }

}


// ============================================================
// RESET DASHBOARD 2
// ============================================================

function resetDashboard2() {

    d2Selected = {

        fy: new Set(),

        type: new Set(),

        brand: new Set(),

        dealer: new Set()

    };


    document.querySelectorAll(
        "#dashboard2 .multi-menu input"
    ).forEach(input => {

        input.checked = false;

    });


    const buttons =
        document.querySelectorAll(
            "#dashboard2 .multi-select > button"
        );


    if (buttons[0])
        buttons[0].textContent =
            "All F Year ▾";


    if (buttons[1])
        buttons[1].textContent =
            "All TYPE ▾";


    if (buttons[2])
        buttons[2].textContent =
            "All BRAND ▾";


    if (buttons[3])
        buttons[3].textContent =
            "All DEALER ▾";


    const from =
        document.getElementById(
            "d2-from"
        );


    const to =
        document.getElementById(
            "d2-to"
        );


    if (from)
        from.value = "";


    if (to)
        to.value = "";


    d2Update();

}
