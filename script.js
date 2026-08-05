// ============================================================
// S SQUARE SALES DASHBOARD
// DASHBOARD 1 + DASHBOARD 2
// ============================================================

const CSV_URL =
"https://docs.google.com/spreadsheets/d/e/2PACX-1vQkx61LU5M5w6cafCI36sVjmFbBZ5lK2krxwI-uxLsblvc0RBX5YHk7C9iKFbQvYM9RAcFQwYcuIdkn/pub?gid=1181069336&single=true&output=csv";


let allData = [];
let charts = {};

// ============================================================
// GLOBAL DATA LOADER
// Google Sheet sirf EK BAAR load hoga
// Dashboard 1 + Dashboard 2 same data use karenge
// ============================================================

let sharedDataPromise = null;
let dataLoaded = false;

const DATA_CACHE_KEY = "ssquare_sales_dashboard_data";
const DATA_CACHE_TIME = 2 * 60 * 1000; // 2 minutes


// ============================================================
// DASHBOARD 1 FILTERS
// ============================================================

const d1FilterDefs = {

    typeFilter: [
        "TYPE",
        "TYPE"
    ],

    agentFilter: [
        "AGENT NAME",
        "AGENT NAME"
    ],

    brandFilter: [
        "BRAND NAME",
        "BRAND NAME"
    ],

    dealerFilter: [
        "DEALER NAME",
        "DEALER NAME"
    ],

    fyFilter: [
        "F YEAR",
        "F YEAR"
    ],

    monthFilter: [
        "MONTH",
        "MONTH"
    ],

    yearFilter: [
        "YEAR",
        "YEAR"
    ],

    quarterFilter: [
        "FY Quarter",
        "FY QUARTER"
    ],

    seasonFilter: [
        "SEASON",
        "SEASON"
    ]

};


const d1Selected = {};

Object.keys(d1FilterDefs).forEach(
    key => d1Selected[key] = new Set()
);


// ============================================================
// TABLE SORT
// ============================================================

let dealerSortColumn = "dealer";

let dealerSortDirection = "asc";


// ============================================================
// CSV PARSER
// ============================================================

function parseCSV(text){

    const rows = [];

    let row = [];

    let value = "";

    let quote = false;


    for(let i=0;i<text.length;i++){

        const c = text[i];

        const next = text[i+1];


        if(c === '"' && quote && next === '"'){

            value += '"';

            i++;

        }

        else if(c === '"'){

            quote = !quote;

        }

        else if(c === ',' && !quote){

            row.push(value.trim());

            value = "";

        }

        else if(
            (c === '\n' || c === '\r')
            && !quote
        ){

            if(c === '\r' && next === '\n'){
                i++;
            }

            row.push(value.trim());

            value = "";


            if(row.some(x => x !== "")){

                rows.push(row);

            }

            row = [];

        }

        else{

            value += c;

        }

    }


    if(value !== "" || row.length){

        row.push(value.trim());

        if(row.some(x => x !== "")){

            rows.push(row);

        }

    }


    if(!rows.length){

        return [];

    }


    const headers =
        rows[0].map(x => x.trim());


    return rows.slice(1).map(r => {

        const obj = {};

        headers.forEach(
            (h,i) => obj[h] = r[i] || ""
        );

        return obj;

    });

}


// ============================================================
// NUMBER
// ============================================================

function num(v){

    if(v == null){

        return 0;

    }


    const n = parseFloat(

        String(v)

        .replace(/₹/g,'')

        .replace(/,/g,'')

        .replace(/\s/g,'')

    );


    return isNaN(n) ? 0 : n;

}


// ============================================================
// MONEY
// ============================================================

function money(v){

    v = Number(v) || 0;


    if(v >= 1e7){

        return "₹ " +
            (v / 1e7).toFixed(2) +
            " Cr";

    }


    if(v >= 1e5){

        return "₹ " +
            (v / 1e5).toFixed(2) +
            " L";

    }


    return "₹ " +
        v.toLocaleString(
            "en-IN",
            {
                maximumFractionDigits:0
            }
        );

}


// ============================================================
// NUMBER FORMAT
// ============================================================

function numberFmt(v){

    return Number(v || 0).toLocaleString(
        "en-IN",
        {
            maximumFractionDigits:0
        }
    );

}


// ============================================================
// PERCENTAGE
// ============================================================

function pct(v){

    return (
        Number(v) || 0
    ).toFixed(2) + "%";

}


// ============================================================
// NORMALIZE
// ============================================================

function norm(v){

    return String(v || "")
        .trim()
        .toUpperCase();

}


// ============================================================
// DATA TYPE
// ============================================================

function dataType(row){

    const s = norm(row["DATA"]);


    if(s.includes("TARGET")){

        return "TARGET";

    }


    if(s.includes("RETURN")){

        return "RETURN";

    }


    if(s.includes("SALE")){

        return "SALE";

    }


    return "SALE";

}


// ============================================================
// VALUES
// ============================================================

function targetOf(row){

    return dataType(row) === "TARGET"
        ? num(row["VALUE"])
        : 0;

}


function saleOf(row){

    return dataType(row) === "SALE"
        ? num(row["VALUE"])
        : 0;

}


function returnOf(row){

    return dataType(row) === "RETURN"
        ? Math.abs(num(row["VALUE"]))
        : 0;

}


function qtySaleOf(row){

    return dataType(row) === "SALE"
        ? num(row["QTY"])
        : 0;

}


function qtyReturnOf(row){

    return dataType(row) === "RETURN"
        ? Math.abs(num(row["QTY"]))
        : 0;

}


function netOf(row){

    return saleOf(row) -
        returnOf(row);

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(s){

    return String(s)

        .replace(/&/g,"&amp;")

        .replace(/</g,"&lt;")

        .replace(/>/g,"&gt;")

        .replace(/"/g,"&quot;");

}


// ============================================================
// LOAD DATA
// ============================================================

// ============================================================
// FAST SHARED GOOGLE SHEET LOADER
// ============================================================

async function loadGoogleSheetData() {

    // Already loading / loaded
    if (sharedDataPromise) {
        return sharedDataPromise;
    }

    sharedDataPromise = (async () => {

        showDataLoading("🔄 Loading Sheet Data...");

        try {

            // ------------------------------------------------
            // STEP 1: Cached data se dashboard turant dikhao
            // ------------------------------------------------

            try {

                const cached = localStorage.getItem(DATA_CACHE_KEY);

                if (cached) {

                    const obj = JSON.parse(cached);

                    if (
                        obj.time &&
                        Array.isArray(obj.data) &&
                        Date.now() - obj.time < DATA_CACHE_TIME
                    ) {

                        allData = obj.data;

                        console.log(
                            "Using cached data:",
                            allData.length,
                            "rows"
                        );

                    }

                }

            } catch (cacheError) {

                console.warn(
                    "Cache read failed:",
                    cacheError
                );

            }


            // ------------------------------------------------
            // STEP 2: Agar cache mila to pehle dashboard dikhao
            // ------------------------------------------------

            if (allData.length) {

                dataLoaded = true;

                setupD1Filters();
                updateDashboard1();

                showDataLoading(
                    "🔄 Syncing latest data..."
                );

            }


            // ------------------------------------------------
            // STEP 3: Latest Google Sheet data fetch
            // ------------------------------------------------

            const url =
                CSV_URL +
                "&t=" +
                Date.now();

            const controller =
                new AbortController();

            const timeout =
                setTimeout(
                    () => controller.abort(),
                    30000
                );

            const response =
                await fetch(
                    url,
                    {
                        method: "GET",
                        cache: "no-store",
                        signal: controller.signal
                    }
                );

            clearTimeout(timeout);


            if (!response.ok) {

                throw new Error(
                    "Google Sheet HTTP Error: " +
                    response.status
                );

            }


            const text =
                await response.text();

            const freshData =
                parseCSV(text);


            if (!freshData.length) {

                throw new Error(
                    "Google Sheet returned empty data"
                );

            }


            // ------------------------------------------------
            // STEP 4: Latest data save
            // ------------------------------------------------

            allData = freshData;

            dataLoaded = true;


            try {

                localStorage.setItem(
                    DATA_CACHE_KEY,
                    JSON.stringify({
                        time: Date.now(),
                        data: allData
                    })
                );

            } catch (cacheError) {

                console.warn(
                    "Cache save failed:",
                    cacheError
                );

            }


            // ------------------------------------------------
            // STEP 5: Dashboard 1 update
            // ------------------------------------------------

            setupD1Filters();

            updateDashboard1();


            // ------------------------------------------------
            // STEP 6: Dashboard 2 agar already open/load ho
            // ------------------------------------------------

            d2Data = allData;
            d2Headers =
                Object.keys(allData[0] || {});


            if (
                document.getElementById("dashboard2") &&
                document.getElementById("dashboard2").style.display !== "none"
            ) {

                d2SetupMulti("fy", "d2-fy");
                d2SetupMulti("type", "d2-type");
                d2SetupMulti("brand", "d2-brand");
                d2SetupMulti("dealer", "d2-dealer");

                d2Update();

            }


            // ------------------------------------------------
            // DONE
            // ------------------------------------------------

            showDataLoading(
                "✓ Data Synced • " +
                numberFmt(allData.length) +
                " Rows"
            );


            setTimeout(
                hideDataLoading,
                1800
            );


            console.log(
                "Google Sheet synced:",
                allData.length,
                "rows"
            );


            return allData;


        } catch (error) {

            console.error(
                "Google Sheet Load Error:",
                error
            );


            // ------------------------------------------------
            // Cache available ho to dashboard ko chalne do
            // ------------------------------------------------

            if (allData.length) {

                dataLoaded = true;

                setupD1Filters();
                updateDashboard1();

                showDataLoading(
                    "⚠ Latest sync failed • Showing saved data"
                );

                setTimeout(
                    hideDataLoading,
                    3500
                );

                return allData;

            }


            showDataLoading(
                "❌ Google Sheet data load failed"
            );


            alert(
                "Data not loading.\n\n" +
                "Internet connection aur Published CSV link check karein."
            );


            throw error;

        }

    })();


    return sharedDataPromise;
}


// ============================================================
// LOADING STATUS
// ============================================================

function showDataLoading(message) {

    let box =
        document.getElementById(
            "dataSyncStatus"
        );


    if (!box) {

        box =
            document.createElement("div");

        box.id =
            "dataSyncStatus";


        box.style.cssText = `
            position:fixed;
            top:15px;
            right:15px;
            z-index:999999;

            background:#ffffff;
            color:#0878bd;

            border:1px solid #b9e3ff;
            border-radius:22px;

            padding:9px 16px;

            font-size:12px;
            font-weight:700;

            box-shadow:0 5px 20px rgba(0,0,0,.12);

            transition:all .3s ease;
        `;


        document.body.appendChild(box);

    }


    box.textContent =
        message;

    box.style.display =
        "block";

}


function hideDataLoading() {

    const box =
        document.getElementById(
            "dataSyncStatus"
        );

    if (box) {

        box.style.opacity =
            "0";

        setTimeout(() => {

            box.style.display =
                "none";

            box.style.opacity =
                "1";

        }, 300);

    }

}
// ============================================================
// SETUP DASHBOARD 1 FILTERS
// ============================================================

function setupD1Filters(){

    Object.entries(d1FilterDefs).forEach(
        ([id,[column,label]]) => {


        const box =
            document.getElementById(
                id + "Box"
            );


        if(!box){

            return;

        }


        const options =
            box.querySelector(
                "#" +
                id +
                "Options"
            );


        if(!options){

            return;

        }


        options.innerHTML = "";


        const values = [

            ...new Set(

                allData

                .map(
                    row =>
                    String(
                        row[column] || ""
                    ).trim()
                )

                .filter(Boolean)

            )

        ];


        values.sort(
            (a,b) =>
            a.localeCompare(
                b,
                undefined,
                {
                    numeric:true
                }
            )
        );


        values.forEach(value => {

            const labelEl =
                document.createElement(
                    "label"
                );


            labelEl.className =
                "filter-option";


            labelEl.innerHTML = `

                <input
                    type="checkbox"
                    value="${escapeHtml(value)}"
                >

                <span>
                    ${escapeHtml(value)}
                </span>

            `;


            options.appendChild(
                labelEl
            );


            const checkbox =
                labelEl.querySelector(
                    "input"
                );


            checkbox.addEventListener(
                "change",
                function(){

                    if(this.checked){

                        d1Selected[id]
                            .add(this.value);

                    }

                    else{

                        d1Selected[id]
                            .delete(this.value);

                    }


                    updateD1Button(
                        id,
                        label
                    );


                    updateDashboard1();

                }
            );

        });


        const allCheckbox =
            box.querySelector(
                ".select-all"
            );


        allCheckbox.checked = true;


        allCheckbox.addEventListener(
            "change",
            function(){

                if(this.checked){

                    d1Selected[id]
                        .clear();


                    options
                        .querySelectorAll(
                            "input"
                        )
                        .forEach(
                            cb =>
                            cb.checked = false
                        );

                }

                else{

                    options
                        .querySelectorAll(
                            "input"
                        )
                        .forEach(
                            cb =>
                            cb.checked = true
                        );


                    values.forEach(
                        value =>
                        d1Selected[id]
                            .add(value)
                    );

                }


                updateD1Button(
                    id,
                    label
                );


                updateDashboard1();

            }
        );

    });

}


// ============================================================
// FILTER SEARCH
// ============================================================

function searchFilter(
    boxId,
    searchValue
){

    const box =
        document.getElementById(
            boxId
        );


    if(!box){

        return;

    }


    const search =
        searchValue.toLowerCase();


    box.querySelectorAll(
        ".filter-option:not(.filter-all)"
    )
    .forEach(option => {

        const text =
            option.textContent
                .toLowerCase();


        option.style.display =
            text.includes(search)
            ? "flex"
            : "none";

    });

}


// ============================================================
// TOGGLE FILTER
// ============================================================

function toggleD1Filter(id){

    const target =
        document.getElementById(id);


    document
        .querySelectorAll(
            ".filter-box"
        )
        .forEach(box => {

            if(box !== target){

                box.classList.remove(
                    "open"
                );

            }

        });


    target.classList.toggle(
        "open"
    );

}


// ============================================================
// CLOSE FILTER
// ============================================================

document.addEventListener(
    "click",
    function(event){

        if(
            !event.target.closest(
                ".filter-box"
            )
        ){

            document
                .querySelectorAll(
                    ".filter-box"
                )
                .forEach(
                    box =>
                    box.classList.remove(
                        "open"
                    )
                );

        }

    }
);


// ============================================================
// FILTER BUTTON TEXT
// ============================================================

function updateD1Button(
    id,
    label
){

    const text =
        document.querySelector(
            "#" +
            id +
            "Box .filter-button span:first-child"
        );


    if(!text){

        return;

    }


    const count =
        d1Selected[id].size;


    text.textContent =
        count
        ? count + " Selected"
        : "All " + label;

}


// ============================================================
// FILTER DATA
// ============================================================

function getD1Data(){

    return allData.filter(row => {

        return Object.entries(
            d1FilterDefs
        ).every(
            ([id,[column]]) => {

                const value =
                    String(
                        row[column] || ""
                    ).trim();


                return (
                    !d1Selected[id].size
                    ||
                    d1Selected[id]
                        .has(value)
                );

            }
        );

    });

}


// ============================================================
// DASHBOARD 1 UPDATE
// ============================================================

function updateDashboard1(){

    const data =
        getD1Data();


    updateD1KPI(data);

    updateDealerStatus(data);

    updateBrandChart(data);

    updateMonthChart(data);

    updateAgentChart(data);

    updateDealerTable(data);

}


// ============================================================
// KPI
// ============================================================

function updateD1KPI(data){

    let target = 0;

    let sale = 0;

    let ret = 0;


    data.forEach(row => {

        target += targetOf(row);

        sale += saleOf(row);

        ret += returnOf(row);

    });


    const net =
        sale - ret;


    document.getElementById(
        "targetValue"
    ).textContent =
        money(target);


    document.getElementById(
        "saleValue"
    ).textContent =
        money(sale);


    document.getElementById(
        "returnValue"
    ).textContent =
        money(ret);


    document.getElementById(
        "netSaleValue"
    ).textContent =
        money(net);


    document.getElementById(
        "achievePercent"
    ).textContent =
        pct(
            target
            ? net / target * 100
            : 0
        );


    document.getElementById(
        "returnPercent"
    ).textContent =
        pct(
            sale
            ? ret / sale * 100
            : 0
        );

}


// ============================================================
// DEALER STATUS
// ============================================================

function updateDealerStatus(data){

    const dealers = {};


    data.forEach(row => {

        const dealer =
            String(
                row["DEALER NAME"] || ""
            ).trim();


        if(!dealer){

            return;

        }


        if(!dealers[dealer]){

            dealers[dealer] = {

                target:0,

                sale:0,

                return:0

            };

        }


        dealers[dealer].target +=
            targetOf(row);


        dealers[dealer].sale +=
            saleOf(row);


        dealers[dealer].return +=
            returnOf(row);

    });


    let targeted = 0;

    let active = 0;

    let newDealer = 0;

    let nonActive = 0;


    Object.values(dealers).forEach(d => {

        const net =
            d.sale - d.return;


        if(d.target > 0){

            targeted++;

        }


        if(net > 0){

            active++;

        }

        else{

            nonActive++;

        }


        if(
            d.target === 0 &&
            net > 0
        ){

            newDealer++;

        }

    });


    document.getElementById(
        "targetedDealer"
    ).textContent =
        numberFmt(targeted);


    document.getElementById(
        "activeDealer"
    ).textContent =
        numberFmt(active);


    document.getElementById(
        "newDealer"
    ).textContent =
        numberFmt(newDealer);


    document.getElementById(
        "nonActiveDealer"
    ).textContent =
        numberFmt(nonActive);

}


// ============================================================
// CHART OPTIONS
// ============================================================

function chartOptions(){

    return {

        responsive:true,

        maintainAspectRatio:false,

        plugins:{

            legend:{

                display:true,

                position:"top"

            },

            tooltip:{

                callbacks:{

                    label:
                    context =>
                    money(
                        context.raw
                    )

                }

            }

        },

        scales:{

            y:{

                beginAtZero:true,

                ticks:{

                    callback:
                    value =>
                    money(value)

                }

            }

        }

    };

}


// ============================================================
// CREATE CHART
// ============================================================

function makeChart(
    id,
    type,
    labels,
    datasets,
    options = {}
){

    const canvas =
        document.getElementById(id);


    if(!canvas){

        return;

    }


    if(charts[id]){

        charts[id].destroy();

    }


    charts[id] =
        new Chart(

            canvas,

            {

                type:type,

                data:{

                    labels:labels,

                    datasets:datasets

                },

                options:{

                    ...chartOptions(),

                    ...options

                }

            }

        );

}


// ============================================================
// GROUP
// ============================================================

function grouped(
    data,
    column
){

    const map = {};


    data.forEach(row => {

        const key =
            row[column] || "Blank";


        if(!map[key]){

            map[key] = {

                target:0,

                net:0

            };

        }


        map[key].target +=
            targetOf(row);


        map[key].net +=
            netOf(row);

    });


    return map;

}


// ============================================================
// BRAND CHART
// ============================================================

function updateBrandChart(data){

    const group =
        grouped(
            data,
            "BRAND NAME"
        );


    const labels =
        Object.keys(group)
        .sort(
            (a,b) =>
            group[b].net -
            group[a].net
        );


    const inner =
        document.querySelector(
            ".brand-chart-inner"
        );


    if(inner){

        inner.style.minWidth =
            Math.max(
                650,
                labels.length * 75
            ) + "px";

    }


    makeChart(

        "brandChart",

        "bar",

        labels,

        [

            {

                label:"Target",

                data:
                    labels.map(
                        x =>
                        group[x].target
                    ),

                borderWidth:1,

                borderRadius:3

            },

            {

                label:"Net Sale",

                data:
                    labels.map(
                        x =>
                        group[x].net
                    ),

                borderWidth:1,

                borderRadius:3

            }

        ]

    );

}


// ============================================================
// MONTH
// ============================================================

function monthOrder(){

    return [

        "Apr",

        "May",

        "Jun",

        "Jul",

        "Aug",

        "Sep",

        "Oct",

        "Nov",

        "Dec",

        "Jan",

        "Feb",

        "Mar"

    ];

}


// ============================================================
// MONTH CHART
// ============================================================

function updateMonthChart(data){

    const group = {};


    data.forEach(row => {

        const key =
            row["MONTH"] ||
            "Blank";


        if(!group[key]){

            group[key] = {

                target:0,

                net:0

            };

        }


        group[key].target +=
            targetOf(row);


        group[key].net +=
            netOf(row);

    });


    const labels = [

        ...monthOrder()
            .filter(
                m => group[m]
            ),

        ...Object.keys(group)
            .filter(
                m =>
                !monthOrder()
                    .includes(m)
            )

    ];


    makeChart(

        "monthChart",

        "line",

        labels,

        [

            {

                label:"Net Sale",

                data:
                    labels.map(
                        x =>
                        group[x].net
                    ),

                borderWidth:3,

                tension:.3,

                fill:false

            },

            {

                label:"Target",

                data:
                    labels.map(
                        x =>
                        group[x].target
                    ),

                borderWidth:3,

                borderDash:[
                    8,
                    5
                ],

                tension:.3,

                fill:false

            }

        ]

    );

}


// ============================================================
// AGENT CHART
// ============================================================

function updateAgentChart(data){

    const group =
        grouped(
            data,
            "AGENT NAME"
        );


    const labels =
        Object.keys(group)
        .sort(
            (a,b) =>
            group[b].net -
            group[a].net
        );


    makeChart(

        "agentChart",

        "bar",

        labels,

        [

            {

                label:"Target",

                data:
                    labels.map(
                        x =>
                        group[x].target
                    ),

                borderWidth:1,

                borderRadius:3

            },

            {

                label:"Net Sale",

                data:
                    labels.map(
                        x =>
                        group[x].net
                    ),

                borderWidth:1,

                borderRadius:3

            }

        ]

    );

}


// ============================================================
// DEALER TABLE - DATA
// ============================================================

function getDealerTableData(rows){

    const dealerColumn =
        "DEALER NAME";


    const groups = {};


    rows.forEach(row => {

        const dealer =
            String(
                row[dealerColumn] || ""
            ).trim();


        const fy =
            String(
                row["F YEAR"] || ""
            ).trim();


        if(!dealer || !fy){

            return;

        }


        const key =
            dealer + "|" + fy;


        if(!groups[key]){

            groups[key] = {

                target:0,

                qty:0,

                net:0

            };

        }


        groups[key].target +=
            targetOf(row);


        groups[key].qty +=
            qtySaleOf(row) -
            qtyReturnOf(row);


        groups[key].net +=
            netOf(row);

    });


    return groups;

}


// ============================================================
// DEALER TABLE
// ============================================================

function updateDealerTable(rows){

    const table =
        document.getElementById(
            "dealer-dashboard-table"
        );


    if(!table){

        return;

    }


    const groups =
        getDealerTableData(rows);


    let years = [

        ...new Set(

            rows

            .map(
                r =>
                String(
                    r["F YEAR"] || ""
                ).trim()
            )

            .filter(Boolean)

        )

    ];


    years.sort(
        (a,b) =>
        String(b).localeCompare(
            String(a),
            undefined,
            {
                numeric:true
            }
        )
    );


    years =
        years.slice(0,3);


    const dealerSet =
        new Set();


    rows.forEach(row => {

        const dealer =
            String(
                row["DEALER NAME"] || ""
            ).trim();


        if(dealer){

            dealerSet.add(dealer);

        }

    });


    let dealers =
        [...dealerSet];


    // ========================================================
    // SORT DEALERS
    // ========================================================

    dealers.sort(
        (a,b) =>
        compareDealerRows(
            a,
            b,
            groups,
            years
        )
    );


    // ========================================================
    // HEADER
    // ========================================================

    let html = `

    <thead>

        <tr>

            <th
                rowspan="2"
                onclick="sortDealerTable('dealer')"
            >

                DEALER NAME

                ${sortIcon("dealer")}

            </th>

    `;


    years.forEach(year => {

        html += `

            <th colspan="4">

                ${escapeHtml(year)}

            </th>

        `;

    });


    html += `

            <th colspan="2">

                GROWTH %

            </th>

        </tr>

        <tr>

    `;


    years.forEach(year => {

        html += `

            <th
                onclick="sortDealerTable('${year}-target')"
            >
                TARGET
                ${sortIcon(year+"-target")}
            </th>

            <th
                onclick="sortDealerTable('${year}-qty')"
            >
                NET QTY
                ${sortIcon(year+"-qty")}
            </th>

            <th
                onclick="sortDealerTable('${year}-net')"
            >
                NET VALUE
                ${sortIcon(year+"-net")}
            </th>

            <th
                onclick="sortDealerTable('${year}-achieve')"
            >
                ACHIEVE %
                ${sortIcon(year+"-achieve")}
            </th>

        `;

    });


    html += `

            <th
                onclick="sortDealerTable('growth1')"
            >
                CY vs PY
                ${sortIcon("growth1")}
            </th>

            <th
                onclick="sortDealerTable('growth2')"
            >
                PY vs 2Y AGO
                ${sortIcon("growth2")}
            </th>

        </tr>

    </thead>

    <tbody>

    `;


    // ========================================================
    // ROWS
    // ========================================================

    dealers.forEach(dealer => {

        const values =
            years.map(
                year =>
                groups[
                    dealer +
                    "|" +
                    year
                ] || {

                    target:0,

                    qty:0,

                    net:0

                }
            );


        html += `

        <tr>

            <td>

                ${escapeHtml(dealer)}

            </td>

        `;


        values.forEach(value => {

            const achievement =
                value.target
                ? value.net /
                    value.target *
                    100
                : 0;


            html += `

                <td>
                    ${money(value.target)}
                </td>

                <td>
                    ${numberFmt(value.qty)}
                </td>

                <td>
                    ${money(value.net)}
                </td>

                <td>
                    ${pct(achievement)}
                </td>

            `;

        });


        const g1 =
            values.length > 1 &&
            values[1].net !== 0

            ?

            (
                (
                    values[0].net -
                    values[1].net
                )
                /
                Math.abs(
                    values[1].net
                )
            ) * 100

            :

            null;


        const g2 =
            values.length > 2 &&
            values[2].net !== 0

            ?

            (
                (
                    values[1].net -
                    values[2].net
                )
                /
                Math.abs(
                    values[2].net
                )
            ) * 100

            :

            null;


        html += `

            <td
                class="${
                    g1 == null
                    ? ""
                    : g1 >= 0
                    ? "growth-positive"
                    : "growth-negative"
                }"
            >

                ${
                    g1 == null
                    ? "—"
                    : pct(g1) +
                      (
                        g1 >= 0
                        ? " ↑"
                        : " ↓"
                      )
                }

            </td>


            <td
                class="${
                    g2 == null
                    ? ""
                    : g2 >= 0
                    ? "growth-positive"
                    : "growth-negative"
                }"
            >

                ${
                    g2 == null
                    ? "—"
                    : pct(g2) +
                      (
                        g2 >= 0
                        ? " ↑"
                        : " ↓"
                      )
                }

            </td>

        </tr>

        `;

    });


    // ========================================================
    // TOTAL ROW
    // ========================================================

    const totals =
        years.map(
            year => {

                let target = 0;

                let qty = 0;

                let net = 0;


                rows.forEach(row => {

                    if(
                        String(
                            row["F YEAR"] || ""
                        ).trim() === year
                    ){

                        target +=
                            targetOf(row);

                        qty +=
                            qtySaleOf(row) -
                            qtyReturnOf(row);

                        net +=
                            netOf(row);

                    }

                });


                return {

                    target,

                    qty,

                    net

                };

            }
        );


    html += `

        <tr class="total-row">

            <td>TOTAL</td>

    `;


    totals.forEach(value => {

        html += `

            <td>
                ${money(value.target)}
            </td>

            <td>
                ${numberFmt(value.qty)}
            </td>

            <td>
                ${money(value.net)}
            </td>

            <td>
                ${
                    pct(
                        value.target
                        ? value.net /
                          value.target *
                          100
                        : 0
                    )
                }
            </td>

        `;

    });


    const totalG1 =
        totals.length > 1 &&
        totals[1].net !== 0

        ?

        (
            (
                totals[0].net -
                totals[1].net
            )
            /
            Math.abs(
                totals[1].net
            )
        ) * 100

        :

        null;


    const totalG2 =
        totals.length > 2 &&
        totals[2].net !== 0

        ?

        (
            (
                totals[1].net -
                totals[2].net
            )
            /
            Math.abs(
                totals[2].net
            )
        ) * 100

        :

        null;


    html += `

            <td
                class="${
                    totalG1 >= 0
                    ? "growth-positive"
                    : "growth-negative"
                }"
            >

                ${
                    totalG1 == null
                    ? "—"
                    : pct(totalG1) +
                      (
                        totalG1 >= 0
                        ? " ↑"
                        : " ↓"
                      )
                }

            </td>


            <td
                class="${
                    totalG2 >= 0
                    ? "growth-positive"
                    : "growth-negative"
                }"
            >

                ${
                    totalG2 == null
                    ? "—"
                    : pct(totalG2) +
                      (
                        totalG2 >= 0
                        ? " ↑"
                        : " ↓"
                      )
                }

            </td>

        </tr>

    `;


    table.innerHTML =
        html +
        "</tbody>";

}


// ============================================================
// SORT ICON
// ============================================================

function sortIcon(column){

    if(
        dealerSortColumn !== column
    ){

        return `<span class="sort-icon">↕</span>`;

    }


    return `

        <span class="sort-icon sort-active">

            ${
                dealerSortDirection === "asc"
                ? "↑"
                : "↓"
            }

        </span>

    `;

}


// ============================================================
// GET SORT VALUE
// ============================================================

function getDealerSortValue(
    dealer,
    column,
    groups,
    years
){

    if(column === "dealer"){

        return dealer.toUpperCase();

    }


    if(
        column === "growth1" ||
        column === "growth2"
    ){

        const values =
            years.map(
                year =>
                groups[
                    dealer +
                    "|" +
                    year
                ] || {

                    target:0,
                    qty:0,
                    net:0

                }
            );


        if(
            column === "growth1"
        ){

            if(
                values.length < 2 ||
                values[1].net === 0
            ){

                return 0;

            }


            return (
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


        if(
            values.length < 3 ||
            values[2].net === 0
        ){

            return 0;

        }


        return (
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


    const parts =
        column.split("-");


    const year =
        parts[0];


    const metric =
        parts[1];


    const value =
        groups[
            dealer +
            "|" +
            year
        ] || {

            target:0,

            qty:0,

            net:0

        };


    if(metric === "achieve"){

        return value.target
            ? value.net /
              value.target *
              100
            : 0;

    }


    return value[metric] || 0;

}


// ============================================================
// COMPARE
// ============================================================

function compareDealerRows(
    a,
    b,
    groups,
    years
){

    const av =
        getDealerSortValue(
            a,
            dealerSortColumn,
            groups,
            years
        );


    const bv =
        getDealerSortValue(
            b,
            dealerSortColumn,
            groups,
            years
        );


    let result;


    if(
        typeof av === "string"
    ){

        result =
            av.localeCompare(
                bv,
                undefined,
                {
                    numeric:true
                }
            );

    }

    else{

        result =
            Number(av) -
            Number(bv);

    }


    return dealerSortDirection === "asc"
        ? result
        : -result;

}


// ============================================================
// SORT TABLE
// ============================================================

function sortDealerTable(column){

    if(
        dealerSortColumn === column
    ){

        dealerSortDirection =
            dealerSortDirection === "asc"
            ? "desc"
            : "asc";

    }

    else{

        dealerSortColumn = column;

        dealerSortDirection = "asc";

    }


    updateDealerTable(
        getD1Data()
    );

}


// ============================================================
// RESET FILTERS
// ============================================================

function resetFilters(){

    Object.keys(
        d1Selected
    ).forEach(
        key =>
        d1Selected[key].clear()
    );


    document
        .querySelectorAll(
            "#dashboard1 .filter-option input[type=checkbox]"
        )
        .forEach(
            checkbox =>
            checkbox.checked = false
        );


    document
        .querySelectorAll(
            "#dashboard1 .select-all"
        )
        .forEach(
            checkbox =>
            checkbox.checked = true
        );


    Object.entries(
        d1FilterDefs
    ).forEach(
        ([id,[column,label]]) =>
        updateD1Button(
            id,
            label
        )
    );


    document
        .querySelectorAll(
            "#dashboard1 .filter-search"
        )
        .forEach(
            input =>
            input.value = ""
        );


    updateDashboard1();

}


// ============================================================
// DASHBOARD 2
// ============================================================

let d2Data = [];

let d2Headers = [];


let d2Selected = {

    fy:new Set(),

    type:new Set(),

    brand:new Set(),

    dealer:new Set()

};


// ============================================================
// DASHBOARD SWITCH
// ============================================================

function showDashboard(n){

    document.getElementById(
        "dashboard1"
    ).style.display =
        n === 1
        ? "block"
        : "none";


    document.getElementById(
        "dashboard2"
    ).style.display =
        n === 2
        ? "block"
        : "none";


    document
        .querySelectorAll(
            ".dash-tab"
        )
        .forEach(
            (button,index) =>
            button.classList.toggle(
                "active",
                index === n - 1
            )
        );


   if(n === 2){

    if(!d2Data.length){

        loadDashboard2();

    }
    else{

        d2Data = allData;

        d2Headers =
            Object.keys(
                allData[0] || {}
            );

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

        d2Update();

    }

}

}


// ============================================================
// MULTI TOGGLE
// ============================================================

function toggleMulti(id){

    const target =
        document.getElementById(id);


    document
        .querySelectorAll(
            ".multi-select"
        )
        .forEach(
            box => {

                if(box !== target){

                    box.classList.remove(
                        "open"
                    );

                }

            }
        );


    target.classList.toggle(
        "open"
    );

}


document.addEventListener(
    "click",
    function(event){

        if(
            !event.target.closest(
                ".multi-select"
            )
        ){

            document
                .querySelectorAll(
                    ".multi-select"
                )
                .forEach(
                    box =>
                    box.classList.remove(
                        "open"
                    )
                );

        }

    }
);


// ============================================================
// FIND COLUMN
// ============================================================

function d2FindColumn(names){

    const headers =
        d2Headers.map(
            h =>
            norm(h)
            .replace(
                /[^A-Z0-9]/g,
                ""
            )
        );


    for(
        const name of names
    ){

        const index =
            headers.indexOf(
                norm(name)
                .replace(
                    /[^A-Z0-9]/g,
                    ""
                )
            );


        if(index >= 0){

            return d2Headers[index];

        }

    }


    return "";

}


// ============================================================
// DATE
// ============================================================

function d2Date(value){

    if(!value){

        return null;

    }


    const s =
        String(value).trim();


    const match =
        s.match(
            /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/
        );


    const date =
        match

        ?

        new Date(
            +match[3],
            +match[2] - 1,
            +match[1]
        )

        :

        new Date(s);


    return isNaN(date)
        ? null
        : date;

}


// ============================================================
// FY
// ============================================================

function d2FY(row){

    const column =
        d2FindColumn(
            [
                "F YEAR",
                "FY",
                "Financial Year"
            ]
        );


    if(
        column &&
        row[column]
    ){

        return String(
            row[column]
        ).trim();

    }


    const dateColumn =
        d2FindColumn(
            [
                "DATE",
                "Invoice Date",
                "Sales Date"
            ]
        );


    const date =
        d2Date(
            row[dateColumn]
        );


    if(!date){

        return "";

    }


    const year =
        date.getFullYear();


    const month =
        date.getMonth() + 1;


    return month >= 4

        ?

        year +
        "-" +
        String(
            year + 1
        ).slice(-2)

        :

        (
            year - 1
        ) +
        "-" +
        String(year).slice(-2);

}


// ============================================================
// D2 VALUES
// ============================================================

function d2Values(type){

    if(type === "fy"){

        return [

            ...new Set(
                d2Data
                .map(d2FY)
                .filter(Boolean)
            )

        ].sort().reverse();

    }


    const map = {

        type:[
            "TYPE"
        ],

        brand:[
            "BRAND NAME",
            "BRAND"
        ],

        dealer:[
            "DEALER NAME",
            "DEALER"
        ]

    };


    const column =
        d2FindColumn(
            map[type]
        );


    return column

        ?

        [

            ...new Set(

                d2Data

                .map(
                    row =>
                    String(
                        row[column] || ""
                    ).trim()
                )

                .filter(Boolean)

            )

        ].sort()

        :

        [];

}


// ============================================================
// D2 MULTI SELECT
// ============================================================

function d2SetupMulti(
    type,
    id
){

    const root =
        document.getElementById(id);


    const menu =
        root.querySelector(
            ".multi-menu"
        );


    const button =
        root.querySelector(
            "button"
        );


    menu.innerHTML = "";


    const search =
        document.createElement(
            "input"
        );


    search.className =
        "multi-search";


    search.placeholder =
        "🔍 Search...";


    menu.appendChild(
        search
    );


    const all =
        document.createElement(
            "label"
        );


    all.className =
        "multi-all";


    all.innerHTML = `

        <input
            type="checkbox"
            checked
        >

        All

    `;


    menu.appendChild(all);


    const list =
        document.createElement(
            "div"
        );


    menu.appendChild(list);


    d2Values(type)
        .forEach(value => {

            const label =
                document.createElement(
                    "label"
                );


            label.innerHTML = `

                <input
                    type="checkbox"
                    value="${escapeHtml(value)}"
                >

                ${escapeHtml(value)}

            `;


            list.appendChild(
                label
            );

        });


    const allCheckbox =
        all.querySelector(
            "input"
        );


    allCheckbox.onchange =
        function(){

            if(this.checked){

                d2Selected[type]
                    .clear();


                list
                    .querySelectorAll(
                        "input"
                    )
                    .forEach(
                        x =>
                        x.checked = false
                    );


                button.textContent =
                    "All " +
                    type.toUpperCase() +
                    " ▾";

            }

            else{

                list
                    .querySelectorAll(
                        "input"
                    )
                    .forEach(
                        x =>
                        x.checked = true
                    );


                d2Values(type)
                    .forEach(
                        value =>
                        d2Selected[type]
                            .add(value)
                    );


                button.textContent =
                    d2Selected[type].size +
                    " Selected ▾";

            }


            d2Update();

        };


    list
        .querySelectorAll(
            "input"
        )
        .forEach(
            checkbox => {

                checkbox.onchange =
                    function(){

                        if(this.checked){

                            d2Selected[type]
                                .add(
                                    this.value
                                );

                        }

                        else{

                            d2Selected[type]
                                .delete(
                                    this.value
                                );

                        }


                        allCheckbox.checked =
                            d2Selected[type].size === 0;


                        button.textContent =
                            d2Selected[type].size

                            ?

                            d2Selected[type].size +
                            " Selected ▾"

                            :

                            "All " +
                            type.toUpperCase() +
                            " ▾";


                        d2Update();

                    };

            }
        );


    search.oninput =
        function(){

            const text =
                this.value.toLowerCase();


            list
                .querySelectorAll(
                    "label"
                )
                .forEach(
                    label => {

                        label.style.display =
                            label.textContent
                                .toLowerCase()
                                .includes(text)
                            ? "block"
                            : "none";

                    }
                );

        };

}


// ============================================================
// D2 FILTERED
// ============================================================

function d2FilteredRows(){

    const from =
        document.getElementById(
            "d2-from"
        ).value

        ?

        new Date(
            document.getElementById(
                "d2-from"
            ).value
        )

        :

        null;


    const to =
        document.getElementById(
            "d2-to"
        ).value

        ?

        new Date(
            document.getElementById(
                "d2-to"
            ).value +
            "T23:59:59"
        )

        :

        null;


    const typeColumn =
        d2FindColumn(
            ["TYPE"]
        );


    const brandColumn =
        d2FindColumn(
            [
                "BRAND NAME",
                "BRAND"
            ]
        );


    const dealerColumn =
        d2FindColumn(
            [
                "DEALER NAME",
                "DEALER"
            ]
        );


    const dateColumn =
        d2FindColumn(
            [
                "DATE",
                "Invoice Date",
                "Sales Date"
            ]
        );


    return d2Data.filter(row => {

        const rowDate =
            d2Date(
                row[dateColumn]
            );


        return (

            (
                !d2Selected.fy.size
                ||
                d2Selected.fy.has(
                    d2FY(row)
                )
            )

            &&

            (
                !d2Selected.type.size
                ||
                d2Selected.type.has(
                    String(
                        row[typeColumn] || ""
                    ).trim()
                )
            )

            &&

            (
                !d2Selected.brand.size
                ||
                d2Selected.brand.has(
                    String(
                        row[brandColumn] || ""
                    ).trim()
                )
            )

            &&

            (
                !d2Selected.dealer.size
                ||
                d2Selected.dealer.has(
                    String(
                        row[dealerColumn] || ""
                    ).trim()
                )
            )

            &&

            (
                (!from && !to)

                ||

                (
                    rowDate

                    &&

                    (!from ||
                        rowDate >= from)

                    &&

                    (!to ||
                        rowDate <= to)
                )

            )

        );

    });

}


// ============================================================
// D2 KPI
// ============================================================

function d2UpdateKPI(rows){

    let target = 0;

    let sale = 0;

    let ret = 0;

    const dealers =
        new Set();


    rows.forEach(row => {

        target +=
            targetOf(row);

        sale +=
            saleOf(row);

        ret +=
            returnOf(row);


        if(
            row["DEALER NAME"]
        ){

            dealers.add(
                row["DEALER NAME"]
            );

        }

    });


    const net =
        sale - ret;


    document.getElementById(
        "d2-target"
    ).textContent =
        money(target);


    document.getElementById(
        "d2-sales"
    ).textContent =
        money(sale);


    document.getElementById(
        "d2-return"
    ).textContent =
        money(ret);


    document.getElementById(
        "d2-net"
    ).textContent =
        money(net);


    document.getElementById(
        "d2-achieve"
    ).textContent =
        pct(
            target
            ? net / target * 100
            : 0
        );


    document.getElementById(
        "d2-return-pct"
    ).textContent =
        pct(
            sale
            ? ret / sale * 100
            : 0
        );


    document.getElementById(
        "d2-dealers"
    ).textContent =
        numberFmt(
            dealers.size
        );

}


// ============================================================
// D2 TABLE
// ============================================================

function d2BuildTable(rows){

    const table =
        document.getElementById(
            "dashboard2-table"
        );


    const brandColumn =
        d2FindColumn(
            [
                "BRAND NAME",
                "BRAND"
            ]
        );


    const years = [

        ...new Set(
            rows
            .map(d2FY)
            .filter(Boolean)
        )

    ]

    .sort(
        (a,b) =>
        String(b).localeCompare(
            String(a),
            undefined,
            {
                numeric:true
            }
        )
    )

    .slice(0,3);


    const groups = {};


    rows.forEach(row => {

        const brand =
            String(
                row[brandColumn] || ""
            ).trim();


        const fy =
            d2FY(row);


        if(
            !brand ||
            !fy
        ){

            return;

        }


        const key =
            brand + "|" + fy;


        if(!groups[key]){

            groups[key] = {

                target:0,

                qty:0,

                net:0

            };

        }


        groups[key].target +=
            targetOf(row);


        groups[key].qty +=
            qtySaleOf(row) -
            qtyReturnOf(row);


        groups[key].net +=
            netOf(row);

    });


    const brands = [

        ...new Set(

            rows

            .map(
                row =>
                String(
                    row[brandColumn] || ""
                ).trim()
            )

            .filter(Boolean)

        )

    ].sort();


    let html = `

        <thead>

            <tr>

                <th rowspan="2">
                    BRAND NAME
                </th>

    `;


    years.forEach(year => {

        html += `

            <th colspan="4">
                ${escapeHtml(year)}
            </th>

        `;

    });


    html += `

            <th colspan="2">
                GROWTH %
            </th>

            </tr>

            <tr>

    `;


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

            </tr>

        </thead>

        <tbody>

    `;


    brands.forEach(brand => {

        const values =
            years.map(
                year =>
                groups[
                    brand +
                    "|" +
                    year
                ] || {

                    target:0,

                    qty:0,

                    net:0

                }
            );


        html += `

            <tr>

                <td>
                    ${escapeHtml(brand)}
                </td>

        `;


        values.forEach(value => {

            html += `

                <td>
                    ${money(value.target)}
                </td>

                <td>
                    ${numberFmt(value.qty)}
                </td>

                <td>
                    ${money(value.net)}
                </td>

                <td>
                    ${
                        pct(
                            value.target
                            ? value.net /
                              value.target *
                              100
                            : 0
                        )
                    }
                </td>

            `;

        });


        let g1 =

            values.length > 1 &&
            values[1].net !== 0

            ?

            (
                (
                    values[0].net -
                    values[1].net
                )
                /
                Math.abs(
                    values[1].net
                )
            ) * 100

            :

            null;


        let g2 =

            values.length > 2 &&
            values[2].net !== 0

            ?

            (
                (
                    values[1].net -
                    values[2].net
                )
                /
                Math.abs(
                    values[2].net
                )
            ) * 100

            :

            null;


        html += `

            <td
                class="${
                    g1 == null
                    ? ""
                    : g1 >= 0
                    ? "growth-positive"
                    : "growth-negative"
                }"
            >

                ${
                    g1 == null
                    ? "—"
                    : pct(g1) +
                      (
                        g1 >= 0
                        ? " ↑"
                        : " ↓"
                      )
                }

            </td>


            <td
                class="${
                    g2 == null
                    ? ""
                    : g2 >= 0
                    ? "growth-positive"
                    : "growth-negative"
                }"
            >

                ${
                    g2 == null
                    ? "—"
                    : pct(g2) +
                      (
                        g2 >= 0
                        ? " ↑"
                        : " ↓"
                      )
                }

            </td>

        </tr>

        `;

    });


      // ========================================================
    // TOTAL ROW
    // ========================================================

    let totalTarget = 0;
    let totalQty = 0;
    let totalNet = 0;

    rows.forEach(row => {

        totalTarget += targetOf(row);

        totalQty +=
            qtySaleOf(row) -
            qtyReturnOf(row);

        totalNet += netOf(row);

    });


    const totalAchievement =
        totalTarget
        ? (
            totalNet /
            totalTarget *
            100
        )
        : 0;


    html += `

        <tr class="total-row">

            <td>TOTAL</td>

            <td>
                ${money(totalTarget)}
            </td>

            <td>
                ${numberFmt(totalQty)}
            </td>

            <td>
                ${money(totalNet)}
            </td>

            <td>
                ${pct(totalAchievement)}
            </td>

            <td>—</td>

            <td>—</td>

        </tr>

        </tbody>

    `;


    table.innerHTML = html;

}


// ============================================================
// D2 UPDATE
// ============================================================

function d2Update(){

    const rows =
        d2FilteredRows();


    d2UpdateKPI(rows);

    d2BuildTable(rows);

}


// ============================================================
// LOAD D2
// ============================================================

async function loadDashboard2() {

    try {

        // Dashboard 1 ka same loaded data use karega
        await loadGoogleSheetData();


        if (!allData.length) {

            throw new Error(
                "No data available"
            );

        }


        d2Data = allData;

        d2Headers =
            Object.keys(
                allData[0] || {}
            );


        // Dashboard 2 filters
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


        document.getElementById(
            "d2-from"
        ).onchange = d2Update;


        document.getElementById(
            "d2-to"
        ).onchange = d2Update;


        d2Update();


    } catch (e) {

        console.error(
            "Dashboard 2 Error:",
            e
        );

    }

}
// ============================================================
// RESET DASHBOARD 2
// ============================================================

function resetDashboard2(){

    d2Selected = {

        fy:new Set(),

        type:new Set(),

        brand:new Set(),

        dealer:new Set()

    };


    document
        .querySelectorAll(
            "#dashboard2 .multi-menu input[type=checkbox]"
        )
        .forEach(
            checkbox =>
            checkbox.checked = false
        );


    document
        .querySelectorAll(
            "#dashboard2 .multi-select button"
        )
        .forEach(
            (button,index) => {

                button.textContent = [

                    "All FY ▾",

                    "All TYPE ▾",

                    "All BRAND ▾",

                    "All DEALER ▾"

                ][index];

            }
        );


    document.getElementById(
        "d2-from"
    ).value = "";


    document.getElementById(
        "d2-to"
    ).value = "";


    d2Update();

}


// ============================================================
// START DASHBOARD
// ============================================================

loadGoogleSheetData();
