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
const DATA_CACHE_TIME = 2 * 60 * 1000;


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
// FAST SHARED GOOGLE SHEET LOADER
// ============================================================

async function loadGoogleSheetData(){

    if(sharedDataPromise){

        return sharedDataPromise;

    }


    sharedDataPromise = (async () => {

        showDataLoading(
            "🔄 Loading Google Sheet Data..."
        );


        try{

            // ------------------------------------------------
            // STEP 1: Cached data
            // ------------------------------------------------

            try{

                const cached =
                    localStorage.getItem(
                        DATA_CACHE_KEY
                    );


                if(cached){

                    const obj =
                        JSON.parse(cached);


                    if(

                        obj.time &&

                        Array.isArray(obj.data) &&

                        Date.now() - obj.time <
                        DATA_CACHE_TIME

                    ){

                        allData = obj.data;


                        console.log(

                            "Using cached data:",

                            allData.length,

                            "rows"

                        );

                    }

                }

            }

            catch(cacheError){

                console.warn(

                    "Cache read failed:",

                    cacheError

                );

            }


            // ------------------------------------------------
            // STEP 2: Cache se dashboard turant dikhao
            // ------------------------------------------------

            if(allData.length){

                dataLoaded = true;

                setupD1Filters();

                updateDashboard1();


                showDataLoading(

                    "🔄 Syncing latest Google Sheet data..."

                );

            }


            // ------------------------------------------------
            // STEP 3: Latest Google Sheet fetch
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

                        method:"GET",

                        cache:"no-store",

                        signal:controller.signal

                    }

                );


            clearTimeout(timeout);


            if(!response.ok){

                throw new Error(

                    "Google Sheet HTTP Error: " +

                    response.status

                );

            }


            const text =

                await response.text();


            const freshData =

                parseCSV(text);


            if(!freshData.length){

                throw new Error(

                    "Google Sheet returned empty data"

                );

            }


            // ------------------------------------------------
            // STEP 4: Latest data save
            // ------------------------------------------------

            allData = freshData;

            dataLoaded = true;


            try{

                localStorage.setItem(

                    DATA_CACHE_KEY,

                    JSON.stringify({

                        time:Date.now(),

                        data:allData

                    })

                );

            }

            catch(cacheError){

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
            // STEP 6: Dashboard 2
            // ------------------------------------------------

            d2Data = allData;

            d2Headers =

                Object.keys(

                    allData[0] || {}

                );


            if(

                document.getElementById(
                    "dashboard2"
                ) &&

                document.getElementById(
                    "dashboard2"
                ).style.display !== "none"

            ){

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


        }

        catch(error){

            console.error(

                "Google Sheet Load Error:",

                error

            );


            if(allData.length){

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

                "Google Sheet se data load nahi ho pa raha hai.\n\n" +

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

function showDataLoading(message){

    let box =

        document.getElementById(

            "dataSyncStatus"

        );


    if(!box){

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


    box.textContent = message;

    box.style.display = "block";

}


function hideDataLoading(){

    const box =

        document.getElementById(

            "dataSyncStatus"

        );


    if(box){

        box.style.opacity = "0";


        setTimeout(() => {

            box.style.display = "none";

            box.style.opacity = "1";

        },300);

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

        }

    );

}

// ============================================================
// DASHBOARD 1 FILTER SEARCH
// ============================================================

function searchFilter(boxId, searchText){

    const box =
        document.getElementById(boxId);

    if(!box){

        return;

    }


    const options =
        box.querySelector(

            "[id$='FilterOptions']"

        );


    if(!options){

        return;

    }


    const search =
        String(searchText || "")

            .trim()

            .toLowerCase();


    options

        .querySelectorAll(

            ".filter-option"

        )

        .forEach(label => {

            const text =

                label.textContent

                    .trim()

                    .toLowerCase();


            label.style.display =

                text.includes(search)

                    ? "flex"

                    : "none";

        });

}


// ============================================================
// DASHBOARD 1 FILTER BUTTON TEXT
// ============================================================

function updateD1Button(id,label){

    const textElement =

        document.getElementById(

            id + "Text"

        );


    if(!textElement){

        return;

    }


    const count =

        d1Selected[id]

            ? d1Selected[id].size

            : 0;


    if(count === 0){

        textElement.textContent =

            "All " + label;

    }

    else{

        textElement.textContent =

            count +

            " Selected " +

            label;

    }

}


// ============================================================
// DASHBOARD 1 FILTERED DATA
// ============================================================

function getD1Data(){

    return allData.filter(row => {

        return Object.entries(

            d1FilterDefs

        ).every(

            ([id,[column]]) => {

                const selected =

                    d1Selected[id];


                if(

                    !selected ||

                    selected.size === 0

                ){

                    return true;

                }


                const value =

                    String(

                        row[column] || ""

                    ).trim();


                return selected.has(value);

            }

        );

    });

}


// ============================================================
// RESET DASHBOARD 1 FILTERS
// ============================================================

function resetFilters(){

    Object.keys(

        d1FilterDefs

    ).forEach(id => {

        d1Selected[id].clear();


        const box =

            document.getElementById(

                id + "Box"

            );


        if(!box){

            return;

        }


        box.querySelectorAll(

            "input[type='checkbox']"

        ).forEach(

            checkbox => {

                checkbox.checked = false;

            }

        );


        const allCheckbox =

            box.querySelector(

                ".select-all"

            );


        if(allCheckbox){

            allCheckbox.checked = true;

        }


        const search =

            box.querySelector(

                ".filter-search"

            );


        if(search){

            search.value = "";

        }


        box.querySelectorAll(

            ".filter-option"

        ).forEach(

            option => {

                option.style.display = "flex";

            }

        );


        const label =

            d1FilterDefs[id][1];


        updateD1Button(

            id,

            label

        );

    });


    updateDashboard1();

}


// ============================================================
// CLOSE DASHBOARD 1 DROPDOWNS
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

                    ".filter-box.open"

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
// OPEN / CLOSE DASHBOARD 1 FILTER
// ============================================================

document.addEventListener(

    "click",

    function(event){

        const button =

            event.target.closest(

                ".filter-button"

            );


        if(!button){

            return;

        }


        const box =

            button.closest(

                ".filter-box"

            );


        if(!box){

            return;

        }


        event.stopPropagation();


        document

            .querySelectorAll(

                ".filter-box.open"

            )

            .forEach(

                other => {

                    if(other !== box){

                        other.classList.remove(

                            "open"

                        );

                    }

                }

            );


        box.classList.toggle(

            "open"

        );

    }

);


// ============================================================
// DASHBOARD 1 UPDATE
// ============================================================

function updateDashboard1(){

    const data =

        getD1Data();


    updateD1KPI(data);

    updateBrandChart(data);

    updateMonthChart(data);

    updateAgentChart(data);

    updateDealerTable(data);

    updateActiveFilterReport(data);

}


// ============================================================
// DASHBOARD 1 KPI
// ============================================================

function updateD1KPI(data){

    let target = 0;

    let sale = 0;

    let ret = 0;


    const dealers =

        new Set();


    data.forEach(row => {

        target += targetOf(row);

        sale += saleOf(row);

        ret += returnOf(row);


        const dealer =

            String(

                row["DEALER NAME"] || ""

            ).trim();


        if(dealer){

            dealers.add(dealer);

        }

    });


    const net =

        sale - ret;


    const targetEl =

        document.getElementById(

            "targetValue"

        );


    const saleEl =

        document.getElementById(

            "saleValue"

        );


    const returnEl =

        document.getElementById(

            "returnValue"

        );


    const netEl =

        document.getElementById(

            "netSaleValue"

        );


    const achieveEl =

        document.getElementById(

            "achievePercent"

        );


    const returnPctEl =

        document.getElementById(

            "returnPercent"

        );


    const dealerEl =

        document.getElementById(

            "dealerCount"

        );


    if(targetEl){

        targetEl.textContent =

            money(target);

    }


    if(saleEl){

        saleEl.textContent =

            money(sale);

    }


    if(returnEl){

        returnEl.textContent =

            money(ret);

    }


    if(netEl){

        netEl.textContent =

            money(net);

    }


    if(achieveEl){

        achieveEl.textContent =

            pct(

                target

                    ? net / target * 100

                    : 0

            );

    }


    if(returnPctEl){

        returnPctEl.textContent =

            pct(

                sale

                    ? ret / sale * 100

                    : 0

            );

    }


    if(dealerEl){

        dealerEl.textContent =

            numberFmt(

                dealers.size

            );

    }

}


// ============================================================
// CHART DEFAULT OPTIONS
// ============================================================

function chartOptions(){

    return {

        responsive:true,

        maintainAspectRatio:false,

        interaction:{

            mode:"index",

            intersect:false

        },

        plugins:{

            legend:{

                display:true,

                position:"top"

            },

            tooltip:{

                callbacks:{

                    label:function(context){

                        return (

                            context.dataset.label +

                            ": " +

                            money(

                                context.raw

                            )

                        );

                    }

                }

            }

        },

        scales:{

            y:{

                beginAtZero:true,

                ticks:{

                    callback:function(value){

                        return money(value);

                    }

                }

            }

        }

    };

}


// ============================================================
// CREATE / UPDATE CHART
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
// GROUP DATA
// ============================================================

function grouped(

    data,

    column

){

    const result = {};


    data.forEach(row => {

        const key =

            String(

                row[column] || "Blank"

            ).trim();


        if(!result[key]){

            result[key] = {

                target:0,

                net:0,

                sale:0,

                ret:0

            };

        }


        result[key].target +=

            targetOf(row);


        result[key].net +=

            netOf(row);


        result[key].sale +=

            saleOf(row);


        result[key].ret +=

            returnOf(row);

    });


    return result;

}


// ============================================================
// BRAND WISE TARGET VS NET SALE
// ============================================================

function updateBrandChart(data){

    const groups =

        grouped(

            data,

            "BRAND NAME"

        );


    const labels =

        Object.keys(groups)

            .sort(

                (a,b) =>

                groups[b].net -

                groups[a].net

            );


    const inner =

        document.querySelector(

            ".brand-chart-inner"

        );


    if(inner){

        inner.style.minWidth =

            Math.max(

                900,

                labels.length * 90

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

                        groups[x].target

                    ),

                borderWidth:1,

                borderRadius:4

            },

            {

                label:"Net Sale",

                data:

                    labels.map(

                        x =>

                        groups[x].net

                    ),

                borderWidth:1,

                borderRadius:4

            }

        ],

        {

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

        }

    );

}


// ============================================================
// MONTH ORDER
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
// MONTH WISE TARGET VS NET SALE
// ============================================================

function updateMonthChart(data){

    const groups = {};


    data.forEach(row => {

        const month =

            String(

                row["MONTH"] ||

                "Blank"

            ).trim();


        if(!groups[month]){

            groups[month] = {

                target:0,

                net:0

            };

        }


        groups[month].target +=

            targetOf(row);


        groups[month].net +=

            netOf(row);

    });


    const labels = [

        ...monthOrder()

            .filter(

                month =>

                groups[month]

            ),

        ...Object.keys(groups)

            .filter(

                month =>

                !monthOrder()

                    .includes(month)

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

                        groups[x].net

                    ),

                borderWidth:3,

                tension:.3,

                fill:false,

                pointRadius:4

            },

            {

                label:"Target",

                data:

                    labels.map(

                        x =>

                        groups[x].target

                    ),

                borderWidth:3,

                borderDash:[8,5],

                tension:.3,

                fill:false,

                pointRadius:3

            }

        ],

        {

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

        }

    );

}


// ============================================================
// AGENT WISE TARGET VS NET SALE
// ============================================================

function updateAgentChart(data){

    const groups =

        grouped(

            data,

            "AGENT NAME"

        );


    const labels =

        Object.keys(groups)

            .sort(

                (a,b) =>

                groups[b].net -

                groups[a].net

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

                        groups[x].target

                    ),

                borderWidth:1,

                borderRadius:4

            },

            {

                label:"Net Sale",

                data:

                    labels.map(

                        x =>

                        groups[x].net

                    ),

                borderWidth:1,

                borderRadius:4

            }

        ],

        {

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

        }

    );

}


// ============================================================
// DEALER STATUS CALCULATION
// ============================================================

function getDealerStatus(data){

    const dealerMap = {};


    data.forEach(row => {

        const dealer =

            String(

                row["DEALER NAME"] || ""

            ).trim();


        if(!dealer){

            return;

        }


        if(!dealerMap[dealer]){

            dealerMap[dealer] = {

                target:0,

                sale:0,

                net:0

            };

        }


        dealerMap[dealer].target +=

            targetOf(row);


        dealerMap[dealer].sale +=

            saleOf(row);


        dealerMap[dealer].net +=

            netOf(row);

    });


    let targeted = 0;

    let active = 0;

    let newDealer = 0;

    let nonActive = 0;


    Object.values(

        dealerMap

    ).forEach(dealer => {

        const hasTarget =

            dealer.target > 0;


        const hasSale =

            dealer.sale > 0;


        if(hasTarget){

            targeted++;

        }


        if(hasSale){

            active++;

        }


        if(

            !hasTarget &&

            hasSale

        ){

            newDealer++;

        }


        if(

            hasTarget &&

            !hasSale

        ){

            nonActive++;

        }

    });


    return {

        targeted,

        active,

        newDealer,

        nonActive,

        dealerMap

    };

}


// ============================================================
// UPDATE DEALER STATUS BOXES
// ============================================================

function updateDealerStatus(data){

    const status =

        getDealerStatus(data);


    const ids = {

        targeted:

            "targetedDealerCount",

        active:

            "activeDealerCount",

        newDealer:

            "newDealerCount",

        nonActive:

            "nonActiveDealerCount"

    };


    Object.entries(ids)

        .forEach(

            ([key,id]) => {

                const element =

                    document.getElementById(

                        id

                    );


                if(element){

                    element.textContent =

                        numberFmt(

                            status[key]

                        );

                }

            }

        );

}


// ============================================================
// ACTIVE FILTER REPORT TEXT
// ============================================================

function getActiveFilterText(){

    const active = [];


    Object.entries(

        d1FilterDefs

    ).forEach(

        ([id,[column,label]]) => {

            const selected =

                d1Selected[id];


            if(

                selected &&

                selected.size > 0

            ){

                active.push(

                    label +

                    ": " +

                    [...selected]

                        .map(

                            escapeHtml

                        )

                        .join(", ")

                );

            }

        }

    );


    if(!active.length){

        return "All Data";

    }


    return active.join("  |  ");

}


// ============================================================
// UPDATE ACTIVE FILTER REPORT
// ============================================================

function updateActiveFilterReport(data){

    const report =

        document.getElementById(

            "activeFilterReport"

        );


    if(!report){

        return;

    }


    report.innerHTML = `

        <span class="report-label">

            Report:

        </span>

        <span>

            ${getActiveFilterText()}

        </span>

        <span class="report-count">

            • ${numberFmt(data.length)} Rows

        </span>

    `;

}


// ============================================================
// DEALER TABLE
// ============================================================

function updateDealerTable(data){

    const table =

        document.getElementById(

            "dealerReportTable"

        );


    if(!table){

        return;

    }


    const status =

        getDealerStatus(data);


    const dealerMap =

        status.dealerMap;


    let dealers =

        Object.keys(

            dealerMap

        );


    // --------------------------------------------------------
    // SORT
    // --------------------------------------------------------

    dealers.sort(

        (a,b) => {

            if(

                dealerSortColumn ===

                "dealer"

            ){

                const result =

                    a.localeCompare(

                        b,

                        undefined,

                        {

                            numeric:true,

                            sensitivity:"base"

                        }

                    );


                return dealerSortDirection ===

                    "asc"

                    ? result

                    : -result;

            }


            const av =

                Number(

                    dealerMap[a][

                        dealerSortColumn

                    ] || 0

                );


            const bv =

                Number(

                    dealerMap[b][

                        dealerSortColumn

                    ] || 0

                );


            return dealerSortDirection ===

                "asc"

                ? av - bv

                : bv - av;

        }

    );


    // --------------------------------------------------------
    // TOTALS
    // --------------------------------------------------------

    let totalTarget = 0;

    let totalSale = 0;

    let totalNet = 0;


    dealers.forEach(

        dealer => {

            totalTarget +=

                dealerMap[dealer].target;

            totalSale +=

                dealerMap[dealer].sale;

            totalNet +=

                dealerMap[dealer].net;

        }

    );


    // --------------------------------------------------------
    // HEADER
    // --------------------------------------------------------

    let html = `

        <thead>

            <tr>

                <th>

                    <button

                        class="table-sort-btn"

                        onclick="sortDealerTable('dealer')"

                        type="button"

                    >

                        S.No / Dealer Name

                        ${sortArrow('dealer')}

                    </button>

                </th>


                <th>

                    <button

                        class="table-sort-btn"

                        onclick="sortDealerTable('target')"

                        type="button"

                    >

                        TARGET

                        ${sortArrow('target')}

                    </button>

                </th>


                <th>

                    <button

                        class="table-sort-btn"

                        onclick="sortDealerTable('sale')"

                        type="button"

                    >

                        SALE

                        ${sortArrow('sale')}

                    </button>

                </th>


                <th>

                    <button

                        class="table-sort-btn"

                        onclick="sortDealerTable('net')"

                        type="button"

                    >

                        NET SALE

                        ${sortArrow('net')}

                    </button>

                </th>


                <th>

                    ACHIEVE %

                </th>


                <th>

                    STATUS

                </th>

            </tr>

        </thead>

        <tbody>

    `;


    // --------------------------------------------------------
    // ROWS
    // --------------------------------------------------------

    dealers.forEach(

        (dealer,index) => {

            const item =

                dealerMap[dealer];


            const achieve =

                item.target

                    ? item.net /

                      item.target *

                      100

                    : 0;


            let statusText =

                "";


            if(

                item.target > 0 &&

                item.sale > 0

            ){

                statusText =

                    "Active Dealer";

            }

            else if(

                item.target === 0 &&

                item.sale > 0

            ){

                statusText =

                    "New Dealer";

            }

            else if(

                item.target > 0 &&

                item.sale === 0

            ){

                statusText =

                    "Non Active Dealer";

            }

            else{

                statusText =

                    "No Activity";

            }


            html += `

                <tr>

                    <td>

                        <strong>

                            ${index + 1}.

                        </strong>

                        ${escapeHtml(dealer)}

                    </td>


                    <td>

                        ${money(item.target)}

                    </td>


                    <td>

                        ${money(item.sale)}

                    </td>


                    <td>

                        ${money(item.net)}

                    </td>


                    <td>

                        ${pct(achieve)}

                    </td>


                    <td>

                        ${escapeHtml(statusText)}

                    </td>

                </tr>

            `;

        }

    );


    // --------------------------------------------------------
    // TOTAL ROW
    // --------------------------------------------------------

    const totalAchieve =

        totalTarget

            ? totalNet /

              totalTarget *

              100

            : 0;


    html += `

        <tr class="total-row">

            <td>

                TOTAL

            </td>


            <td>

                ${money(totalTarget)}

            </td>


            <td>

                ${money(totalSale)}

            </td>


            <td>

                ${money(totalNet)}

            </td>


            <td>

                ${pct(totalAchieve)}

            </td>


            <td>

                ${numberFmt(dealers.length)}

                Dealers

            </td>

        </tr>

    `;


    html += `

        </tbody>

    `;


    table.innerHTML = html;


    updateDealerTableSortStatus();

}


// ============================================================
// SORT ARROW
// ============================================================

function sortArrow(column){

    if(

        dealerSortColumn !== column

    ){

        return "↕";

    }


    return dealerSortDirection ===

        "asc"

        ? "↑"

        : "↓";

}


// ============================================================
// SORT DEALER TABLE
// ============================================================

function sortDealerTable(column){

    if(

        dealerSortColumn === column

    ){

        dealerSortDirection =

            dealerSortDirection ===

            "asc"

                ? "desc"

                : "asc";

    }

    else{

        dealerSortColumn = column;

        dealerSortDirection =

            "asc";

    }


    updateDealerTable(

        getD1Data()

    );

}


// ============================================================
// SORT STATUS
// ============================================================

function updateDealerTableSortStatus(){

    const status =

        document.getElementById(

            "dealerSortStatus"

        );


    if(!status){

        return;

    }


    const names = {

        dealer:

            "Dealer Name",

        target:

            "Target",

        sale:

            "Sale",

        net:

            "Net Sale"

    };


    status.textContent =

        "Sorted by " +

        names[dealerSortColumn] +

        " " +

        (

            dealerSortDirection ===

            "asc"

                ? "Ascending ↑"

                : "Descending ↓"

        );

}


// ============================================================
// EXPORT CSV / EXCEL
// ============================================================

function exportDealerCSV(){

    const rows =

        getD1Data();


    const status =

        getDealerStatus(rows);


    const map =

        status.dealerMap;


    let dealers =

        Object.keys(map);


    dealers.sort(

        (a,b) =>

        a.localeCompare(

            b,

            undefined,

            {

                numeric:true,

                sensitivity:"base"

            }

        )

    );


    const csvRows = [];


    csvRows.push([

        "S.No",

        "Dealer Name",

        "Target",

        "Sale",

        "Net Sale",

        "Achieve %",

        "Status"

    ]);


    dealers.forEach(

        (dealer,index) => {

            const d =

                map[dealer];


            const achieve =

                d.target

                    ? d.net /

                      d.target *

                      100

                    : 0;


            let dealerStatus =

                "";


            if(

                d.target > 0 &&

                d.sale > 0

            ){

                dealerStatus =

                    "Active Dealer";

            }

            else if(

                d.target === 0 &&

                d.sale > 0

            ){

                dealerStatus =

                    "New Dealer";

            }

            else if(

                d.target > 0 &&

                d.sale === 0

            ){

                dealerStatus =

                    "Non Active Dealer";

            }


            csvRows.push([

                index + 1,

                dealer,

                d.target,

                d.sale,

                d.net,

                achieve.toFixed(2) + "%",

                dealerStatus

            ]);

        }

    );


    const csv =

        csvRows.map(

            row =>

            row.map(

                cell =>

                    '"' +

                    String(cell)

                        .replace(

                            /"/g,

                            '""'

                        ) +

                    '"'

            ).join(",")

        ).join("\n");


    const blob =

        new Blob(

            [csv],

            {

                type:

                "text/csv;charset=utf-8;"

            }

        );


    const url =

        URL.createObjectURL(blob);


    const a =

        document.createElement("a");


    a.href = url;


    a.download =

        "S_Square_Dealer_Report.csv";


    document.body.appendChild(a);


    a.click();


    a.remove();


    URL.revokeObjectURL(url);

}


// ============================================================
// EXPORT EXCEL
// ============================================================

function exportDealerExcel(){

    const rows =

        getD1Data();


    const status =

        getDealerStatus(rows);


    const map =

        status.dealerMap;


    let dealers =

        Object.keys(map);


    dealers.sort(

        (a,b) =>

        a.localeCompare(

            b,

            undefined,

            {

                numeric:true,

                sensitivity:"base"

            }

        )

    );


    let html = `

        <table border="1">

            <tr>

                <th>S.No</th>

                <th>Dealer Name</th>

                <th>Target</th>

                <th>Sale</th>

                <th>Net Sale</th>

                <th>Achieve %</th>

                <th>Status</th>

            </tr>

    `;


    dealers.forEach(

        (dealer,index) => {

            const d =

                map[dealer];


            const achieve =

                d.target

                    ? d.net /

                      d.target *

                      100

                    : 0;


            let dealerStatus =

                "";


            if(

                d.target > 0 &&

                d.sale > 0

            ){

                dealerStatus =

                    "Active Dealer";

            }

            else if(

                d.target === 0 &&

                d.sale > 0

            ){

                dealerStatus =

                    "New Dealer";

            }

            else if(

                d.target > 0 &&

                d.sale === 0

            ){

                dealerStatus =

                    "Non Active Dealer";

            }


            html += `

                <tr>

                    <td>${index + 1}</td>

                    <td>${escapeHtml(dealer)}</td>

                    <td>${d.target}</td>

                    <td>${d.sale}</td>

                    <td>${d.net}</td>

                    <td>${achieve.toFixed(2)}%</td>

                    <td>${dealerStatus}</td>

                </tr>

            `;

        }

    );


    html += "</table>";


    const blob =

        new Blob(

            [

                "\ufeff" +

                html

            ],

            {

                type:

                "application/vnd.ms-excel"

            }

        );


    const url =

        URL.createObjectURL(blob);


    const a =

        document.createElement("a");


    a.href = url;


    a.download =

        "S_Square_Dealer_Report.xls";


    document.body.appendChild(a);


    a.click();


    a.remove();


    URL.revokeObjectURL(url);

}


// ============================================================
// PRINT / PDF EXPORT
// ============================================================

function exportDealerPDF(){

    const table =

        document.getElementById(

            "dealerReportTable"

        );


    if(!table){

        alert(

            "Dealer table nahi mila."

        );

        return;

    }


    const reportText =

        getActiveFilterText();


    const printWindow =

        window.open(

            "",

            "_blank"

        );


    if(!printWindow){

        alert(

            "Popup blocked hai. Browser mein popup allow karein."

        );

        return;

    }


    printWindow.document.write(`

        <!DOCTYPE html>

        <html>

        <head>

            <title>

                S Square Dealer Report

            </title>


            <style>

                body{

                    font-family:Arial,sans-serif;

                    padding:25px;

                    color:#17324d;

                }


                h1{

                    text-align:center;

                    margin-bottom:5px;

                }


                .filter{

                    text-align:center;

                    margin-bottom:20px;

                    font-size:12px;

                    color:#566b7d;

                }


                table{

                    width:100%;

                    border-collapse:collapse;

                }


                th{

                    background:#0878bd;

                    color:white;

                    padding:8px;

                    border:1px solid #ddd;

                    font-size:11px;

                }


                td{

                    padding:7px;

                    border:1px solid #ddd;

                    font-size:10px;

                }


                .total-row{

                    font-weight:bold;

                    background:#eaf6ff;

                }


                @media print{

                    @page{

                        size:landscape;

                        margin:10mm;

                    }

                }

            </style>

        </head>


        <body>

            <h1>

                S Square Marketing

            </h1>


            <div class="filter">

                ${reportText}

            </div>


            ${table.outerHTML}

        </body>

        </html>

    `);


    printWindow.document.close();


    printWindow.focus();


    setTimeout(

        () => {

            printWindow.print();

        },

        500

    );

}

/* =========================================================
   PART 3
   DASHBOARD 1 - DEALER WISE TABLE
   SERIAL NO + SORTING + FILTER REPORT
========================================================= */

let dealerTableSort = {
    column: "dealer",
    direction: "asc"
};


/* =========================================================
   DEALER TABLE SORT
========================================================= */

function sortDealerTable(column) {

    if (dealerTableSort.column === column) {

        dealerTableSort.direction =
            dealerTableSort.direction === "asc"
                ? "desc"
                : "asc";

    } else {

        dealerTableSort.column = column;
        dealerTableSort.direction = "asc";

    }

    updateDealerWiseTable();
}


/* =========================================================
   SORT ICON
========================================================= */

function dealerSortIcon(column) {

    if (dealerTableSort.column !== column) {
        return "↕";
    }

    return dealerTableSort.direction === "asc"
        ? "↑"
        : "↓";
}


/* =========================================================
   GET DEALER TABLE DATA
========================================================= */

function getDealerTableData(data) {

    const dealers = {};

    data.forEach(row => {

        const dealer =
            String(row["DEALER NAME"] || "").trim();

        if (!dealer) return;

        if (!dealers[dealer]) {

            dealers[dealer] = {
                dealer: dealer,
                target: 0,
                sale: 0,
                returnValue: 0,
                net: 0,
                qty: 0
            };

        }

        dealers[dealer].target += targetOf(row);

        dealers[dealer].sale += saleOf(row);

        dealers[dealer].returnValue += returnOf(row);

        dealers[dealer].net += netOf(row);

        dealers[dealer].qty +=
            qtySaleOf(row) - qtyReturnOf(row);

    });


    return Object.values(dealers);

}


/* =========================================================
   SORT DEALER DATA
========================================================= */

function sortDealerData(data) {

    const column = dealerTableSort.column;
    const direction = dealerTableSort.direction;

    return data.sort((a, b) => {

        let av = a[column];
        let bv = b[column];

        if (column === "dealer") {

            av = String(av || "").toLowerCase();
            bv = String(bv || "");

            const result =
                av.localeCompare(
                    bv.toLowerCase(),
                    undefined,
                    {
                        numeric: true,
                        sensitivity: "base"
                    }
                );

            return direction === "asc"
                ? result
                : -result;
        }


        av = Number(av) || 0;
        bv = Number(bv) || 0;

        if (av === bv) return 0;

        const result = av > bv ? 1 : -1;

        return direction === "asc"
            ? result
            : -result;

    });

}


/* =========================================================
   DEALER TABLE - ACTIVE FILTER DISPLAY
========================================================= */

function getActiveD1FilterText() {

    const active = [];

    Object.entries(d1FilterDefs).forEach(
        ([id, [column, label]]) => {

            const selected =
                d1Selected[id];

            if (
                selected &&
                selected.size > 0
            ) {

                active.push(
                    label +
                    ": " +
                    [...selected].join(", ")
                );

            }

        }
    );


    if (!active.length) {

        return "Report: All Data";

    }

    return "Report: " + active.join("  |  ");

}


/* =========================================================
   UPDATE FILTER REPORT TEXT
========================================================= */

function updateDealerTableFilterInfo() {

    const box =
        document.getElementById(
            "dealerTableFilterInfo"
        );

    if (!box) return;

    box.textContent =
        getActiveD1FilterText();

}


/* =========================================================
   DEALER WISE TABLE
========================================================= */

function updateDealerWiseTable() {

    const table =
        document.getElementById(
            "dashboard1-dealer-table"
        );

    if (!table) return;


    const data =
        getD1Data();


    let dealerData =
        getDealerTableData(data);


    dealerData =
        sortDealerData(dealerData);


    /* =====================================================
       TOTALS
    ===================================================== */

    let totalTarget = 0;
    let totalQty = 0;
    let totalNet = 0;


    dealerData.forEach(row => {

        totalTarget += row.target;

        totalQty += row.qty;

        totalNet += row.net;

    });


    /* =====================================================
       TABLE HEADER
    ===================================================== */

    let html = `

        <thead>

            <tr>

                <th>
                    S.No
                </th>

                <th
                    class="sortable-header"
                    onclick="sortDealerTable('dealer')"
                    title="Click to sort"
                >
                    DEALER NAME
                    ${dealerSortIcon("dealer")}
                </th>

                <th
                    class="sortable-header"
                    onclick="sortDealerTable('target')"
                    title="Click to sort"
                >
                    TARGET
                    ${dealerSortIcon("target")}
                </th>

                <th
                    class="sortable-header"
                    onclick="sortDealerTable('qty')"
                    title="Click to sort"
                >
                    NET QTY
                    ${dealerSortIcon("qty")}
                </th>

                <th
                    class="sortable-header"
                    onclick="sortDealerTable('net')"
                    title="Click to sort"
                >
                    NET VALUE
                    ${dealerSortIcon("net")}
                </th>

                <th
                    class="sortable-header"
                    onclick="sortDealerTable('achieve')"
                    title="Click to sort"
                >
                    ACHIEVE %
                    ${dealerSortIcon("achieve")}
                </th>

            </tr>

        </thead>

        <tbody>
    `;


    /* =====================================================
       ROWS
    ===================================================== */

    dealerData.forEach((row, index) => {

        const achieve =
            row.target
                ? (row.net / row.target) * 100
                : 0;


        /* Store calculated value for sorting */
        row.achieve = achieve;


        const achieveClass =
            achieve >= 100
                ? "growth-positive"
                : "growth-negative";


        html += `

            <tr>

                <td class="serial-number">
                    ${index + 1}
                </td>

                <td class="dealer-name">
                    ${escapeHtml(row.dealer)}
                </td>

                <td>
                    ${money(row.target)}
                </td>

                <td>
                    ${numberFmt(row.qty)}
                </td>

                <td>
                    ${money(row.net)}
                </td>

                <td class="${achieveClass}">
                    ${pct(achieve)}
                </td>

            </tr>

        `;

    });


    /* =====================================================
       TOTAL ROW
    ===================================================== */

    const totalAchieve =
        totalTarget
            ? (totalNet / totalTarget) * 100
            : 0;


    html += `

        <tr class="total-row">

            <td></td>

            <td>
                TOTAL
            </td>

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
                ${pct(totalAchieve)}
            </td>

        </tr>

    `;


    html += `</tbody>`;


    table.innerHTML = html;


    updateDealerTableFilterInfo();

}


/* =========================================================
   CONNECT DEALER TABLE WITH DASHBOARD 1
========================================================= */

function updateDashboard1DealerTable() {

    updateDealerWiseTable();

}


/* =========================================================
   UPDATE DASHBOARD 1
   TABLE INCLUDED
========================================================= */

function updateDashboard1WithDealerTable() {

    const data =
        getD1Data();

    updateD1KPI(data);

    updateBrandChart(data);

    updateMonthChart(data);

    updateAgentChart(data);

    updateDealerWiseTable();

}


/* =========================================================
   TABLE EXPORT DATA HELPER
========================================================= */

function getDealerExportData() {

    const data =
        getD1Data();

    let rows =
        getDealerTableData(data);

    rows =
        sortDealerData(rows);


    return rows.map((row, index) => {

        const achieve =
            row.target
                ? (row.net / row.target) * 100
                : 0;


        return {

            "S.No": index + 1,

            "Dealer Name": row.dealer,

            "Target": row.target,

            "Net Qty": row.qty,

            "Net Value": row.net,

            "Achieve %": achieve

        };

    });

}


/* =========================================================
   DEBUG / CHECK
========================================================= */

console.log(
    "PART 3 - Dealer Table Loaded"
);

// ============================================================
// PART 4 — FIXED VERSION
// DASHBOARD 1
// Dealer Wise Table + Sorting + Current Filter Report
// Excel Export + PDF Export
// IMPORTANT: Existing Part 1/2/3 functions ko replace nahi karta.
// ============================================================

(function () {

  // ------------------------------------------------------------
  // GLOBAL TABLE SETTINGS
  // ------------------------------------------------------------

  let d1TableSortColumn = "dealer";
  let d1TableSortDirection = "asc";

  // ------------------------------------------------------------
  // SAFE HTML
  // ------------------------------------------------------------

  function d1Safe(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ------------------------------------------------------------
  // GET FILTER TEXT
  // ------------------------------------------------------------

  function d1CurrentFilterText() {

    const defs = [
      ["typeFilter", "TYPE"],
      ["agentFilter", "AGENT NAME"],
      ["brandFilter", "BRAND NAME"],
      ["dealerFilter", "DEALER NAME"],
      ["fyFilter", "F YEAR"],
      ["monthFilter", "MONTH"],
      ["yearFilter", "YEAR"],
      ["quarterFilter", "FY QUARTER"],
      ["seasonFilter", "SEASON"]
    ];

    return defs.map(function (item) {

      const id = item[0];
      const label = item[1];

      if (
        typeof d1Selected === "undefined" ||
        !d1Selected[id] ||
        d1Selected[id].size === 0
      ) {
        return label + ": All";
      }

      return label + ": " +
        Array.from(d1Selected[id]).join(", ");

    }).join(" | ");
  }

  // ------------------------------------------------------------
  // CREATE / FIND TABLE AREA
  // ------------------------------------------------------------

  function d1GetTableCard() {

    let card = document.getElementById("dashboard1-table-card");

    if (card) return card;

    const dashboard = document.getElementById("dashboard1");

    if (!dashboard) return null;

    card = document.createElement("div");
    card.id = "dashboard1-table-card";
    card.className = "dashboard1-table-card";

    card.innerHTML = `
      <div class="d1-table-heading">
        <div>
          <h2>DEALER WISE TARGET vs ACHIEVEMENT</h2>
          <div class="d1-table-subtitle">
            LAST 3 FINANCIAL YEARS COMPARISON
          </div>
        </div>

        <div class="d1-table-actions">
          <button type="button"
                  id="d1ExportExcel"
                  class="d1-export-excel">
            📊 Export Excel
          </button>

          <button type="button"
                  id="d1ExportPDF"
                  class="d1-export-pdf">
            📄 Export PDF
          </button>
        </div>
      </div>

      <div class="d1-sort-help">
        Click column header to sort
        <br>
        ↑ Ascending / ↓ Descending
      </div>

      <div class="d1-table-scroll">
        <table id="dashboard1-table">
        </table>
      </div>
    `;

    dashboard.appendChild(card);

    document.getElementById("d1ExportExcel")
      .addEventListener("click", d1ExportExcel);

    document.getElementById("d1ExportPDF")
      .addEventListener("click", d1ExportPDF);

    return card;
  }

  // ------------------------------------------------------------
  // TABLE CSS
  // ------------------------------------------------------------

  function d1AddTableCSS() {

    if (document.getElementById("d1-fixed-table-css")) return;

    const style = document.createElement("style");
    style.id = "d1-fixed-table-css";

    style.textContent = `

      .dashboard1-table-card {
        margin-top: 16px;
        background: #fff;
        border: 1px solid #b7ddfa;
        border-radius: 12px;
        padding: 14px;
        position: relative;
        overflow: hidden;
      }

      .d1-table-heading {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 15px;
        margin-bottom: 5px;
      }

      .d1-table-heading h2 {
        margin: 0;
        font-size: 20px;
        color: #0879bd;
      }

      .d1-table-subtitle {
        margin-top: 4px;
        font-size: 12px;
        color: #718096;
      }

      .d1-table-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .d1-table-actions button {
        border: 0;
        color: #fff;
        padding: 10px 18px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }

      .d1-export-excel {
        background: #159447;
      }

      .d1-export-pdf {
        background: #e44747;
      }

      .d1-sort-help {
        position: absolute;
        right: 18px;
        top: 55px;
        color: #159447;
        font-size: 11px;
        text-align: right;
        line-height: 1.3;
      }

      .d1-table-scroll {
        margin-top: 10px;
        overflow-x: auto;
        overflow-y: auto;
        max-height: 600px;
        border-radius: 6px;
      }

      #dashboard1-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 1100px;
        font-size: 12px;
      }

      #dashboard1-table th {
        background: #087dbb;
        color: #fff;
        padding: 9px 7px;
        border: 1px solid #d6e8f5;
        text-align: center;
        white-space: nowrap;
        cursor: pointer;
        user-select: none;
      }

      #dashboard1-table th:hover {
        background: #056b9f;
      }

      #dashboard1-table td {
        padding: 7px;
        border: 1px solid #dce8ef;
        white-space: nowrap;
      }

      #dashboard1-table tbody tr:nth-child(even) {
        background: #f5faff;
      }

      #dashboard1-table tbody tr:hover {
        background: #eaf6ff;
      }

      #dashboard1-table td:first-child {
        text-align: center;
        font-weight: 600;
      }

      #dashboard1-table td:nth-child(2) {
        text-align: left;
        font-weight: 600;
      }

      #dashboard1-table td:not(:nth-child(2)):not(:first-child) {
        text-align: right;
      }

      .d1-sort-arrow {
        font-size: 11px;
        margin-left: 4px;
      }

      .d1-growth-positive {
        color: #159447;
        font-weight: 700;
      }

      .d1-growth-negative {
        color: #df3434;
        font-weight: 700;
      }

      .d1-report-line {
        margin-top: 10px;
        background: #fff;
        border: 1px solid #b7ddfa;
        border-radius: 10px;
        padding: 12px 15px;
        color: #2d5877;
        font-size: 14px;
      }

      .d1-report-line strong {
        color: #087dbb;
      }

      @media(max-width:700px) {

        .d1-table-heading {
          flex-direction: column;
        }

        .d1-sort-help {
          position: static;
          text-align: left;
          margin-bottom: 8px;
        }

        .d1-table-actions {
          width: 100%;
        }

        .d1-table-actions button {
          flex: 1;
        }

      }

    `;

    document.head.appendChild(style);
  }

  // ------------------------------------------------------------
  // GET COLUMN NAME SAFELY
  // ------------------------------------------------------------

  function d1Column(possibleNames) {

    if (typeof allData === "undefined" || !allData.length) {
      return "";
    }

    const headers = Object.keys(allData[0]);

    for (const name of possibleNames) {

      const target = String(name)
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "");

      const found = headers.find(function (h) {

        return String(h)
          .trim()
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, "") === target;

      });

      if (found) return found;
    }

    return "";
  }

  // ------------------------------------------------------------
  // FINANCIAL YEAR
  // ------------------------------------------------------------

  function d1GetFY(row) {

    const fyCol = d1Column([
      "F YEAR",
      "FY",
      "FINANCIAL YEAR"
    ]);

    if (fyCol && row[fyCol]) {
      return String(row[fyCol]).trim();
    }

    return "";
  }

  // ------------------------------------------------------------
  // DEALER-WISE DATA
  // ------------------------------------------------------------

  function d1BuildDealerData(rows) {

    const dealerCol = d1Column([
      "DEALER NAME",
      "DEALER"
    ]);

    if (!dealerCol) return {};

    const groups = {};

    rows.forEach(function (r) {

      const dealer = String(r[dealerCol] || "").trim();

      if (!dealer) return;

      const fy = d1GetFY(r);

      if (!groups[dealer]) {
        groups[dealer] = {};
      }

      if (!groups[dealer][fy]) {
        groups[dealer][fy] = {
          target: 0,
          qty: 0,
          net: 0
        };
      }

      groups[dealer][fy].target += targetOf(r);
      groups[dealer][fy].qty +=
        qtySaleOf(r) - qtyReturnOf(r);

      groups[dealer][fy].net += netOf(r);

    });

    return groups;
  }

  // ------------------------------------------------------------
  // SORT YEARS
  // ------------------------------------------------------------

  function d1GetYears(rows) {

    const years = [
      ...new Set(
        rows
          .map(d1GetFY)
          .filter(Boolean)
      )
    ];

    return years.sort(function (a, b) {

      return String(b).localeCompare(
        String(a),
        undefined,
        {
          numeric: true
        }
      );

    }).slice(0, 3);
  }

  // ------------------------------------------------------------
  // SORT TABLE
  // ------------------------------------------------------------

  function d1SortRows(list) {

    return list.sort(function (a, b) {

      let av = a[d1TableSortColumn];
      let bv = b[d1TableSortColumn];

      if (
        d1TableSortColumn === "dealer"
      ) {

        av = String(av || "").toUpperCase();
        bv = String(bv || "").toUpperCase();

      } else {

        av = Number(av || 0);
        bv = Number(bv || 0);

      }

      let result = 0;

      if (typeof av === "string") {

        result = av.localeCompare(
          bv,
          undefined,
          {
            numeric: true,
            sensitivity: "base"
          }
        );

      } else {

        result = av - bv;

      }

      return d1TableSortDirection === "asc"
        ? result
        : -result;

    });

  }

  // ------------------------------------------------------------
  // SORT HEADER
  // ------------------------------------------------------------

  function d1SortHeader(key) {

    if (d1TableSortColumn === key) {

      d1TableSortDirection =
        d1TableSortDirection === "asc"
          ? "desc"
          : "asc";

    } else {

      d1TableSortColumn = key;
      d1TableSortDirection = "asc";

    }

    d1RenderTable();

  }

  window.d1SortHeader = d1SortHeader;

  // ------------------------------------------------------------
  // SORT ARROW
  // ------------------------------------------------------------

  function d1Arrow(key) {

    if (d1TableSortColumn !== key) {
      return "↕";
    }

    return d1TableSortDirection === "asc"
      ? "↑"
      : "↓";
  }

  // ------------------------------------------------------------
  // TABLE HEADER
  // ------------------------------------------------------------

  function d1TH(text, key, rowSpan, colSpan) {

    rowSpan = rowSpan || 1;
    colSpan = colSpan || 1;

    return `
      <th
        rowspan="${rowSpan}"
        colspan="${colSpan}"
        onclick="d1SortHeader('${key}')"
      >
        ${d1Safe(text)}
        <span class="d1-sort-arrow">
          ${d1Arrow(key)}
        </span>
      </th>
    `;
  }

  // ------------------------------------------------------------
  // RENDER TABLE
  // ------------------------------------------------------------

  function d1RenderTable() {

    const table = document.getElementById(
      "dashboard1-table"
    );

    if (!table) return;

    if (
      typeof allData === "undefined" ||
      !Array.isArray(allData) ||
      !allData.length
    ) {

      table.innerHTML = `
        <tbody>
          <tr>
            <td style="text-align:center;padding:30px;">
              Data loading...
            </td>
          </tr>
        </tbody>
      `;

      return;
    }

    let rows;

    try {

      rows = getD1Data();

    } catch (e) {

      console.error(
        "Dashboard 1 filter error:",
        e
      );

      rows = allData;

    }

    const years = d1GetYears(rows);
    const groups = d1BuildDealerData(rows);

    let dealers = Object.keys(groups);

    dealers = dealers.map(function (dealer) {

      const vals = years.map(function (fy) {

        return groups[dealer][fy] || {
          target: 0,
          qty: 0,
          net: 0
        };

      });

      const current =
        vals.length > 0 ? vals[0] : {
          target: 0,
          qty: 0,
          net: 0
        };

      const previous =
        vals.length > 1 ? vals[1] : {
          target: 0,
          qty: 0,
          net: 0
        };

      const twoYearsAgo =
        vals.length > 2 ? vals[2] : {
          target: 0,
          qty: 0,
          net: 0
        };

      const growth1 =
        previous.net !== 0
          ? (
              (current.net - previous.net) /
              Math.abs(previous.net)
            ) * 100
          : null;

      const growth2 =
        twoYearsAgo.net !== 0
          ? (
              (previous.net - twoYearsAgo.net) /
              Math.abs(twoYearsAgo.net)
            ) * 100
          : null;

      return {
        dealer: dealer,
        vals: vals,
        target: current.target,
        qty: current.qty,
        net: current.net,
        achieve:
          current.target
            ? (current.net / current.target) * 100
            : 0,
        growth1: growth1,
        growth2: growth2
      };

    });

    // Sorting
    dealers.sort(function (a, b) {

      let av;
      let bv;

      switch (d1TableSortColumn) {

        case "target":
          av = a.target;
          bv = b.target;
          break;

        case "qty":
          av = a.qty;
          bv = b.qty;
          break;

        case "net":
          av = a.net;
          bv = b.net;
          break;

        case "achieve":
          av = a.achieve;
          bv = b.achieve;
          break;

        case "growth1":
          av = a.growth1 == null
            ? -Infinity
            : a.growth1;

          bv = b.growth1 == null
            ? -Infinity
            : b.growth1;

          break;

        case "growth2":
          av = a.growth2 == null
            ? -Infinity
            : a.growth2;

          bv = b.growth2 == null
            ? -Infinity
            : b.growth2;

          break;

        default:
          av = a.dealer.toUpperCase();
          bv = b.dealer.toUpperCase();

      }

      let result;

      if (typeof av === "string") {

        result = av.localeCompare(
          bv,
          undefined,
          {
            numeric: true,
            sensitivity: "base"
          }
        );

      } else {

        result = av - bv;

      }

      return d1TableSortDirection === "asc"
        ? result
        : -result;

    });

    // ----------------------------------------------------------
    // HEADER
    // ----------------------------------------------------------

    let html = `
      <thead>

        <tr>

          ${d1TH("S.NO", "sno", 2, 1)}

          ${d1TH(
            "DEALER NAME",
            "dealer",
            2,
            1
          )}

    `;

    years.forEach(function (year) {

      html += `
        <th colspan="4">
          ${d1Safe(year)}
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

    years.forEach(function () {

      html += `
        ${d1TH("TARGET", "target")}
        ${d1TH("NET QTY", "qty")}
        ${d1TH("NET VALUE", "net")}
        ${d1TH("ACHIEVE %", "achieve")}
      `;

    });

    html += `
          ${d1TH("CY vs PY", "growth1")}
          ${d1TH("PY vs 2Y AGO", "growth2")}
        </tr>

      </thead>

      <tbody>
    `;

    // ----------------------------------------------------------
    // BODY
    // ----------------------------------------------------------

    dealers.forEach(function (dealer, index) {

      html += `
        <tr>

          <td>${index + 1}</td>

          <td>
            ${d1Safe(dealer.dealer)}
          </td>
      `;

      dealer.vals.forEach(function (v) {

        html += `
          <td>${money(v.target)}</td>
          <td>${numberFmt(v.qty)}</td>
          <td>${money(v.net)}</td>
          <td>${pct(
            v.target
              ? (v.net / v.target) * 100
              : 0
          )}</td>
        `;

      });

      const g1 = dealer.growth1;
      const g2 = dealer.growth2;

      html += `
        <td class="${
          g1 == null
            ? ""
            : g1 >= 0
              ? "d1-growth-positive"
              : "d1-growth-negative"
        }">
          ${
            g1 == null
              ? "—"
              : pct(g1) +
                (g1 >= 0 ? " ↑" : " ↓")
          }
        </td>

        <td class="${
          g2 == null
            ? ""
            : g2 >= 0
              ? "d1-growth-positive"
              : "d1-growth-negative"
        }">
          ${
            g2 == null
              ? "—"
              : pct(g2) +
                (g2 >= 0 ? " ↑" : " ↓")
          }
        </td>

        </tr>
      `;

    });

    if (!dealers.length) {

      html += `
        <tr>
          <td
            colspan="${2 + years.length * 4 + 2}"
            style="
              text-align:center;
              padding:30px;
              color:#777;
            "
          >
            No data found for selected filters.
          </td>
        </tr>
      `;

    }

    html += `
      </tbody>
    `;

    table.innerHTML = html;

  }

  // ------------------------------------------------------------
  // CURRENT REPORT LINE
  // ------------------------------------------------------------

  function d1RenderCurrentReport() {

    const dashboard =
      document.getElementById("dashboard1");

    if (!dashboard) return;

    let line =
      document.getElementById(
        "d1-current-report"
      );

    if (!line) {

      line = document.createElement("div");
      line.id = "d1-current-report";
      line.className = "d1-report-line";

      dashboard.appendChild(line);

    }

    line.innerHTML = `
      <strong>Current Report:</strong>
      ${d1Safe(d1CurrentFilterText())}
    `;

  }

  // ------------------------------------------------------------
  // EXPORT EXCEL
  // ------------------------------------------------------------

  function d1ExportExcel() {

    const table =
      document.getElementById(
        "dashboard1-table"
      );

    if (!table) {

      alert("Dashboard 1 table nahi mila.");
      return;

    }

    const reportName =
      "Dealer Wise Target vs Achievement";

    const html = `
      <html>
      <head>
        <meta charset="UTF-8">
      </head>
      <body>

        <h2>S Square Marketing Pvt. Ltd. & S Square Ventures</h2>

        <h3>${reportName}</h3>

        <p>
          ${d1CurrentFilterText()}
        </p>

        ${table.outerHTML}

      </body>
      </html>
    `;

    const blob = new Blob(
      ["\ufeff", html],
      {
        type:
          "application/vnd.ms-excel;charset=utf-8;"
      }
    );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement("a");

    a.href = url;
    a.download =
      "Dealer_Wise_Target_vs_Achievement.xls";

    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

  }

  // ------------------------------------------------------------
  // EXPORT PDF
  // ------------------------------------------------------------

  function d1ExportPDF() {

    const table =
      document.getElementById(
        "dashboard1-table"
      );

    if (!table) {

      alert("Dashboard 1 table nahi mila.");
      return;

    }

    const win =
      window.open(
        "",
        "_blank"
      );

    if (!win) {

      alert(
        "PDF ke liye popup allow karein."
      );

      return;

    }

    win.document.write(`
      <!DOCTYPE html>

      <html>

      <head>

        <meta charset="UTF-8">

        <title>
          Dealer Wise Target vs Achievement
        </title>

        <style>

          @page {
            size: landscape;
            margin: 10mm;
          }

          body {
            font-family: Arial, sans-serif;
            font-size: 9px;
          }

          h2 {
            color: #087dbb;
            margin-bottom: 4px;
          }

          h3 {
            margin: 4px 0;
          }

          table {
            width: 100%;
            border-collapse: collapse;
          }

          th {
            background: #087dbb;
            color: white;
            border: 1px solid #ccc;
            padding: 5px;
          }

          td {
            border: 1px solid #ccc;
            padding: 4px;
          }

          td {
            text-align: right;
          }

          td:nth-child(1),
          td:nth-child(2) {
            text-align: left;
          }

        </style>

      </head>

      <body>

        <h2>
          S Square Marketing Pvt. Ltd. & S Square Ventures
        </h2>

        <h3>
          Dealer Wise Target vs Achievement
        </h3>

        <div>
          ${d1Safe(d1CurrentFilterText())}
        </div>

        <br>

        ${table.outerHTML}

      </body>

      </html>
    `);

    win.document.close();

    setTimeout(function () {

      win.focus();
      win.print();

    }, 500);

  }

  // ------------------------------------------------------------
  // WRAP EXISTING DASHBOARD 1 UPDATE
  // ------------------------------------------------------------

  function d1InstallUpdateHook() {

    if (
      typeof window.updateDashboard1 !==
      "function"
    ) {

      return false;

    }

    if (
      window.updateDashboard1.__d1FixedPart4
    ) {

      return true;

    }

    const oldUpdate =
      window.updateDashboard1;

    function fixedUpdateDashboard1() {

      // IMPORTANT:
      // Pehle existing KPI + charts update honge.
      oldUpdate();

      // Uske baad table/report update hoga.
      d1RenderTable();
      d1RenderCurrentReport();

    }

    fixedUpdateDashboard1.__d1FixedPart4 = true;

    window.updateDashboard1 =
      fixedUpdateDashboard1;

    return true;

  }

  // ------------------------------------------------------------
  // INITIALIZE
  // ------------------------------------------------------------

  function d1Part4Init() {

    d1AddTableCSS();

    d1GetTableCard();

    d1InstallUpdateHook();

    if (
      typeof allData !== "undefined" &&
      Array.isArray(allData) &&
      allData.length
    ) {

      d1RenderTable();
      d1RenderCurrentReport();

    }

  }

  // ------------------------------------------------------------
  // RECHECK AFTER EXISTING SCRIPT LOAD
  // ------------------------------------------------------------

  document.addEventListener(
    "DOMContentLoaded",
    function () {

      d1Part4Init();

      setTimeout(
        d1Part4Init,
        500
      );

      setTimeout(
        d1Part4Init,
        1500
      );

      setTimeout(
        d1Part4Init,
        3000
      );

    }
  );

  // ------------------------------------------------------------
  // ALSO WATCH DATA LOAD
  // ------------------------------------------------------------

  const d1Wait =
    setInterval(function () {

      if (
        typeof allData !== "undefined" &&
        Array.isArray(allData) &&
        allData.length
      ) {

        d1Part4Init();

        clearInterval(d1Wait);

      }

    }, 500);

})();
