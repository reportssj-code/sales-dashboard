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
// PART 4
// EXPORT + ACTIVE FILTER REPORT
// Paste this AFTER PART 3
// ============================================================


// ============================================================
// LOAD EXCEL LIBRARY
// ============================================================

function loadXLSX(){

    return new Promise((resolve,reject)=>{

        if(window.XLSX){
            resolve();
            return;
        }

        const script=document.createElement("script");

        script.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

        script.onload=()=>resolve();
        script.onerror=()=>reject("Excel library load failed");

        document.head.appendChild(script);

    });

}


// ============================================================
// LOAD PDF LIBRARY
// ============================================================

function loadPDF(){

    return new Promise((resolve,reject)=>{

        if(window.jspdf){
            resolve();
            return;
        }

        const script=document.createElement("script");

        script.src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";

        script.onload=()=>{

            const autoTable=document.createElement("script");

            autoTable.src=
            "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";

            autoTable.onload=()=>resolve();

            autoTable.onerror=()=>reject("PDF table library load failed");

            document.head.appendChild(autoTable);

        };

        script.onerror=()=>reject("PDF library load failed");

        document.head.appendChild(script);

    });

}


// ============================================================
// GET ACTIVE FILTER REPORT
// ============================================================

function getActiveFilterReport(){

    const filters=[];

    Object.entries(d1FilterDefs).forEach(([id,[col,label]])=>{

        const selected=d1Selected[id];

        if(selected && selected.size){

            filters.push(
                label + ": " + [...selected].join(", ")
            );

        }else{

            filters.push(
                label + ": All"
            );

        }

    });

    return filters;

}


// ============================================================
// FILTER REPORT TEXT
// ============================================================

function getFilterReportText(){

    const filters=getActiveFilterReport();

    return filters.join(" | ");

}


// ============================================================
// SHOW ACTIVE FILTER REPORT
// ============================================================

function updateActiveFilterReport(){

    let box=document.getElementById("activeFilterReport");

    if(!box){

        box=document.createElement("div");

        box.id="activeFilterReport";

        box.style.cssText=`

            background:#ffffff;
            border:1px solid #b9e3ff;
            border-radius:10px;
            padding:10px 14px;
            margin:0 0 15px 0;
            color:#36566e;
            font-size:13px;
            line-height:1.6;
            box-shadow:0 2px 8px rgba(0,0,0,.04);

        `;

        const tableCard=document.querySelector(
            "#dashboard1 .dashboard1-table-card"
        );

        if(tableCard){

            tableCard.parentNode.insertBefore(
                box,
                tableCard
            );

        }else{

            const dashboard=document.getElementById("dashboard1");

            if(dashboard){

                dashboard.appendChild(box);

            }

        }

    }

    box.innerHTML=

        "<b style='color:#0878bd;'>Current Report:</b> " +

        getFilterReportText();

}


// ============================================================
// EXPORT TABLE DATA
// ============================================================

function getDashboard1TableData(){

    const table=document.getElementById(
        "dashboard1-dealer-table"
    ) || document.getElementById(
        "dealerWiseTable"
    ) || document.querySelector(
        "#dashboard1 table"
    );

    if(!table){

        alert("Dashboard 1 Dealer Table nahi mila.");

        return null;

    }

    return table;

}


// ============================================================
// EXPORT TO EXCEL
// ============================================================

async function exportDashboard1Excel(){

    try{

        await loadXLSX();

        const table=getDashboard1TableData();

        if(!table)return;

        const wb=XLSX.utils.book_new();

        const ws=XLSX.utils.table_to_sheet(table);

        XLSX.utils.book_append_sheet(
            wb,
            ws,
            "Dealer Wise Report"
        );


        // ----------------------------------------------------
        // FILTER INFORMATION
        // ----------------------------------------------------

        const filterText=getFilterReportText();

        XLSX.utils.sheet_add_aoa(

            ws,

            [
                [],
                ["FILTER REPORT"],
                [filterText]
            ],

            {
                origin:-1
            }

        );


        // ----------------------------------------------------
        // COLUMN WIDTH
        // ----------------------------------------------------

        const range=XLSX.utils.decode_range(
            ws["!ref"]
        );

        const widths=[];

        for(let c=range.s.c;c<=range.e.c;c++){

            let max=12;

            for(let r=range.s.r;r<=range.e.r;r++){

                const cell=
                    ws[
                        XLSX.utils.encode_cell({
                            r:r,
                            c:c
                        })
                    ];

                if(cell && cell.v!=null){

                    max=Math.max(
                        max,
                        String(cell.v).length+2
                    );

                }

            }

            widths.push({
                wch:Math.min(max,35)
            });

        }

        ws["!cols"]=widths;


        // ----------------------------------------------------
        // FILE NAME
        // ----------------------------------------------------

        const now=new Date();

        const date=

            now.getFullYear()+"-"+

            String(now.getMonth()+1).padStart(2,"0")+"-"+

            String(now.getDate()).padStart(2,"0");


        XLSX.writeFile(

            wb,

            "S_Square_Dealer_Wise_Report_"+date+".xlsx"

        );

    }

    catch(error){

        console.error(error);

        alert(
            "Excel export nahi ho paya. Please dobara try karein."
        );

    }

}


// ============================================================
// EXPORT TO PDF
// ============================================================

async function exportDashboard1PDF(){

    try{

        await loadPDF();

        const table=getDashboard1TableData();

        if(!table)return;

        const {jsPDF}=window.jspdf;


        // ----------------------------------------------------
        // LANDSCAPE PDF
        // ----------------------------------------------------

        const doc=new jsPDF({

            orientation:"landscape",

            unit:"mm",

            format:"a4"

        });


        // ----------------------------------------------------
        // TITLE
        // ----------------------------------------------------

        doc.setFontSize(16);

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.text(

            "S Square Marketing Pvt. Ltd. & S Square Ventures",

            148,

            12,

            {
                align:"center"
            }

        );


        doc.setFontSize(11);

        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.text(

            "Dealer Wise Sales Report",

            148,

            19,

            {
                align:"center"
            }

        );


        // ----------------------------------------------------
        // FILTER REPORT
        // ----------------------------------------------------

        const filterText=getFilterReportText();

        doc.setFontSize(7);

        const filterLines=
            doc.splitTextToSize(
                "Filters: "+filterText,
                275
            );

        doc.text(
            filterLines,
            10,
            27
        );


        // ----------------------------------------------------
        // TABLE
        // ----------------------------------------------------

        doc.autoTable({

            html:table,

            startY:35,

            theme:"grid",

            styles:{

                fontSize:7,

                cellPadding:2,

                overflow:"linebreak",

                halign:"right"

            },

            headStyles:{

                fillColor:[8,120,189],

                textColor:255,

                fontStyle:"bold",

                halign:"center"

            },

            columnStyles:{

                0:{
                    halign:"center"
                }

            },

            didParseCell:function(data){

                if(
                    data.section==="body" &&
                    data.column.index===0
                ){

                    data.cell.styles.halign="center";

                }

            }

        });


        // ----------------------------------------------------
        // FOOTER
        // ----------------------------------------------------

        const pages=
            doc.internal.getNumberOfPages();

        for(let i=1;i<=pages;i++){

            doc.setPage(i);

            doc.setFontSize(7);

            doc.text(

                "Page "+i+" of "+pages,

                285,

                202,

                {
                    align:"right"
                }

            );

        }


        // ----------------------------------------------------
        // SAVE
        // ----------------------------------------------------

        const now=new Date();

        const date=

            now.getFullYear()+"-"+

            String(now.getMonth()+1).padStart(2,"0")+"-"+

            String(now.getDate()).padStart(2,"0");


        doc.save(

            "S_Square_Dealer_Wise_Report_"+date+".pdf"

        );

    }

    catch(error){

        console.error(error);

        alert(
            "PDF export nahi ho paya. Please dobara try karein."
        );

    }

}


// ============================================================
// EXPORT BUTTONS CREATE
// ============================================================

function createDashboard1ExportButtons(){

    let existing=
        document.getElementById(
            "dashboard1ExportButtons"
        );

    if(existing)return;


    const table=

        document.getElementById(
            "dashboard1-dealer-table"
        ) ||

        document.getElementById(
            "dealerWiseTable"
        ) ||

        document.querySelector(
            "#dashboard1 table"
        );


    if(!table)return;


    const wrapper=document.createElement("div");

    wrapper.id="dashboard1ExportButtons";

    wrapper.style.cssText=`

        display:flex;
        justify-content:flex-end;
        align-items:center;
        gap:8px;
        margin-bottom:10px;
        flex-wrap:wrap;

    `;


    // ----------------------------------------------------
    // EXCEL BUTTON
    // ----------------------------------------------------

    const excel=document.createElement("button");

    excel.type="button";

    excel.innerHTML="📊 Export Excel";

    excel.style.cssText=`

        border:none;
        background:#168a45;
        color:#ffffff;
        padding:9px 16px;
        border-radius:7px;
        font-size:13px;
        font-weight:700;
        cursor:pointer;

    `;

    excel.onclick=exportDashboard1Excel;


    // ----------------------------------------------------
    // PDF BUTTON
    // ----------------------------------------------------

    const pdf=document.createElement("button");

    pdf.type="button";

    pdf.innerHTML="📄 Export PDF";

    pdf.style.cssText=`

        border:none;
        background:#d64545;
        color:#ffffff;
        padding:9px 16px;
        border-radius:7px;
        font-size:13px;
        font-weight:700;
        cursor:pointer;

    `;

    pdf.onclick=exportDashboard1PDF;


    wrapper.appendChild(excel);

    wrapper.appendChild(pdf);


    table.parentNode.insertBefore(

        wrapper,

        table

    );

}


// ============================================================
// REFRESH REPORT UI
// ============================================================

function refreshDashboard1ReportUI(){

    updateActiveFilterReport();

    createDashboard1ExportButtons();

}


// ============================================================
// HOOK INTO DASHBOARD 1 UPDATE
// ============================================================

const _originalUpdateDashboard1=
    window.updateDashboard1;

if(typeof _originalUpdateDashboard1==="function"){

    window.updateDashboard1=function(){

        _originalUpdateDashboard1();

        setTimeout(
            refreshDashboard1ReportUI,
            100
        );

    };

}


// ============================================================
// INITIAL LOAD
// ============================================================

document.addEventListener(

    "DOMContentLoaded",

    function(){

        setTimeout(

            refreshDashboard1ReportUI,

            1500

        );

    }

);


// ============================================================
// PART 4 END
// ============================================================
