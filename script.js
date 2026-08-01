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
