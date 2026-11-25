/* ==========================================================================
   Body Scent — script.js (ใช้ร่วมกันทุกหน้า)

   แต่ละหน้าจะทำงานเฉพาะเมื่อพบ element ของตัวเองเท่านั้น:
   - product.html : #filter-bar, #product-list
   - order.html   : #orderForm, #customerName, #contact, #items, #total, #note
   - admin.html   : #ordersTable tbody
   ========================================================================== */

(function () {
  "use strict";

  /* ------------------------------------------------------------------------
     ค่าคงที่
     ------------------------------------------------------------------------ */
  var PRODUCTS_URL = "products.json";

  var ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbzkEB9p19mMHdrWQo1LTEb4H1PTaeBgU1isBCiGyj9aG97FqglIN513tz1u9MQIOhcs-w/exec";

  var ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSIusBWb6iWzQ3EQeINU9AkoRiXi1Znhcunaer0X9upbZPBTV-pFd34DspIYwjcysJZObTtfFSj1A26/pub?gid=0&single=true&output=csv";

  var MOODS = [
    { key: "all", label: "ทั้งหมด" },
    { key: "fresh", label: "Fresh" },
    { key: "sweet", label: "Sweet" },
    { key: "confident", label: "Confident" },
    { key: "romance", label: "Romance" }
  ];

  /* ------------------------------------------------------------------------
     Helper
     ------------------------------------------------------------------------ */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatPrice(value) {
    var n = Number(value);
    return isNaN(n) ? String(value) : n.toLocaleString("th-TH");
  }

  /* ========================================================================
     1) หน้า product.html — การ์ดสินค้า + ตัวกรอง mood
     ======================================================================== */
  function initProductPage() {
    var filterBar = document.getElementById("filter-bar");
    var list = document.getElementById("product-list");
    if (!filterBar || !list) return;

    var products = [];
    var currentMood = "all";

    function isValidMood(m) {
      return MOODS.some(function (x) { return x.key === m; });
    }

    // ชื่อที่ส่งไปหน้าสั่งซื้อ: ชื่อสินค้า + ไซส์ (ถ้ามี)
    function itemLabel(p) {
      return p.size ? p.name + " " + p.size : p.name;
    }

    function orderUrl(p) {
      var params = new URLSearchParams();
      params.set("item", itemLabel(p));
      params.set("price", String(p.price));
      return "order.html?" + params.toString();
    }

    function buildCard(p) {
      var card = el("article", "product-card");
      card.setAttribute("data-mood", p.mood);

      var media = el("div", "product-card__media");
      var img = document.createElement("img");
      img.src = p.image;
      img.alt = itemLabel(p);
      img.loading = "lazy";
      media.appendChild(img);

      var body = el("div", "product-card__body");
      body.appendChild(el("span", "mood-tag", p.mood));
      body.appendChild(el("h3", "product-card__title", p.name));
      body.appendChild(el("div", "product-card__meta", p.size || ""));

      var footer = el("div", "product-card__footer");
      var price = el("span", "price", formatPrice(p.price));
      price.appendChild(el("small", "", "บาท"));
      var btn = el("a", "btn btn--accent", "สั่งซื้อ");
      btn.href = orderUrl(p);
      footer.appendChild(price);
      footer.appendChild(btn);

      body.appendChild(footer);
      card.appendChild(media);
      card.appendChild(body);
      return card;
    }

    function renderProducts() {
      list.textContent = "";
      var shown = products.filter(function (p) {
        return currentMood === "all" || p.mood === currentMood;
      });

      if (!shown.length) {
        list.appendChild(el("p", "text-center", "ไม่พบสินค้าในหมวดนี้"));
        return;
      }
      shown.forEach(function (p) { list.appendChild(buildCard(p)); });
    }

    function updateButtons() {
      filterBar.querySelectorAll(".filter-btn").forEach(function (b) {
        var active = b.getAttribute("data-mood-filter") === currentMood;
        b.classList.toggle("is-active", active);
        b.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }

    function setMood(mood, updateUrl) {
      currentMood = isValidMood(mood) ? mood : "all";
      updateButtons();
      renderProducts();

      if (updateUrl && window.history && history.replaceState) {
        var url = new URL(window.location.href);
        if (currentMood === "all") url.searchParams.delete("mood");
        else url.searchParams.set("mood", currentMood);
        history.replaceState(null, "", url.toString());
      }
    }

    function buildFilterBar() {
      filterBar.textContent = "";
      MOODS.forEach(function (m) {
        var btn = el("button", "filter-btn");
        btn.type = "button";
        btn.setAttribute("data-mood-filter", m.key);
        if (m.key !== "all") {
          btn.setAttribute("data-mood", m.key);
          btn.appendChild(el("span", "mood-dot"));
        }
        btn.appendChild(document.createTextNode(m.label));
        btn.addEventListener("click", function () { setMood(m.key, true); });
        filterBar.appendChild(btn);
      });
    }

    buildFilterBar();
    list.appendChild(el("p", "text-center", "กำลังโหลดสินค้า..."));

    fetch(PRODUCTS_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        products = Array.isArray(data) ? data : [];
        var initial = new URLSearchParams(window.location.search).get("mood");
        setMood(initial ? initial.toLowerCase() : "all", false);
      })
      .catch(function (err) {
        console.error(err);
        list.textContent = "";
        list.appendChild(
          el("p", "text-center", "ไม่สามารถโหลดสินค้าได้ กรุณาลองใหม่อีกครั้ง")
        );
      });
  }

  /* ========================================================================
     2) หน้า order.html — เติมฟอร์มอัตโนมัติ + ส่งคำสั่งซื้อ
     ======================================================================== */
  function initOrderPage() {
    var form = document.getElementById("orderForm");
    if (!form) return;

    var params = new URLSearchParams(window.location.search);
    var item = params.get("item");
    var price = params.get("price");

    var itemsInput = document.getElementById("items");
    var totalInput = document.getElementById("total");

    // เติมทั้งสองช่องทันทีที่โหลดหน้า
    if (itemsInput && item !== null) itemsInput.value = item;
    if (totalInput && price !== null) totalInput.value = price;

    form.addEventListener("submit", function (e) {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      function val(id) {
        var node = document.getElementById(id);
        return node ? node.value.trim() : "";
      }

      var payload = {
        customerName: val("customerName"),
        contact: val("contact"),
        items: val("items"),
        total: val("total"),
        note: val("note")
      };

      var submitBtn = form.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(() => { window.location.href = "thankyou.html"; })
        .catch(error => {
          console.error(error);
          if (submitBtn) submitBtn.disabled = false;
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
        });
    });
  }

  /* ========================================================================
     3) หน้า admin.html — ตารางคำสั่งซื้อจาก Google Sheet (CSV)
     ======================================================================== */

  // parse CSV เอง: รองรับ "..." ครอบค่า, "" แทน ", คอมมาและขึ้นบรรทัดใหม่ในช่อง, CRLF, BOM
  function parseCSV(text) {
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    var rows = [];
    var row = [];
    var field = "";
    var inQuotes = false;

    for (var i = 0; i < text.length; i++) {
      var c = text[i];

      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }

    // แถวสุดท้ายที่ไม่มี newline ปิดท้าย
    if (field !== "" || row.length) {
      row.push(field);
      rows.push(row);
    }

    // ตัดแถวว่าง
    return rows.filter(function (r) {
      return r.some(function (cell) { return cell.trim() !== ""; });
    });
  }

  function initAdminPage() {
    var tbody = document.querySelector("#ordersTable tbody");
    if (!tbody) return;

    var COLS = 6; // วันเวลา, ชื่อลูกค้า, เบอร์โทร/Line, รายการสินค้า, จำนวนเงินรวม, หมายเหตุ

    function messageRow(text) {
      tbody.textContent = "";
      var tr = document.createElement("tr");
      var td = el("td", "text-center", text);
      td.colSpan = COLS;
      tr.appendChild(td);
      tbody.appendChild(tr);
    }

    messageRow("กำลังโหลดข้อมูล...");

    fetch(ORDERS_CSV_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var rows = parseCSV(text);

        // แถวแรกคือหัวคอลัมน์ ข้ามไป
        var data = rows.slice(1);

        if (!data.length) {
          messageRow("ยังไม่มีคำสั่งซื้อ");
          return;
        }

        // Apps Script เพิ่มแถวต่อท้ายเสมอ → กลับลำดับให้รายการล่าสุดขึ้นก่อน
        data.reverse();

        tbody.textContent = "";
        data.forEach(function (r) {
          var tr = document.createElement("tr");
          for (var i = 0; i < COLS; i++) {
            var cell = r[i] !== undefined ? r[i] : "";
            if (i === 4) cell = formatPrice(cell.replace(/,/g, "").trim() || cell);
            tr.appendChild(el("td", "", cell));
          }
          tbody.appendChild(tr);
        });
      })
      .catch(function (err) {
        console.error(err);
        messageRow("ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
      });
  }

  /* ------------------------------------------------------------------------
     เริ่มทำงาน
     ------------------------------------------------------------------------ */
  function init() {
    initProductPage();
    initOrderPage();
    initAdminPage();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
