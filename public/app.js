document.addEventListener('DOMContentLoaded', () => {
  const startDateInput = document.getElementById('startDate');
  const endDateInput = document.getElementById('endDate');
  const fetchBtn = document.getElementById('fetchBtn');
  const searchInput = document.getElementById('searchInput');
  const exportBtn = document.getElementById('exportBtn');
  const tableBody = document.getElementById('tableBody');
  const summaryCards = document.getElementById('summaryCards');
  const loading = document.getElementById('loading');
  const errorMsg = document.getElementById('errorMsg');
  const tableWrapper = document.getElementById('tableWrapper');
  const emptyState = document.getElementById('emptyState');

  let allRows = [];
  let filteredRows = [];
  let sortCol = 'date';
  let sortDir = 'desc';

  // Set default dates: last 30 days
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(today.getDate() - 30);
  endDateInput.value = formatDateForInput(today);
  startDateInput.value = formatDateForInput(thirtyDaysAgo);

  function formatDateForInput(date) {
    return date.toISOString().split('T')[0];
  }

  function formatCurrency(amount) {
    return '₪' + amount.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Fetch data
  fetchBtn.addEventListener('click', fetchData);

  async function fetchData() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    if (!startDate || !endDate) {
      showError('יש לבחור תאריך התחלה ותאריך סיום');
      return;
    }

    // Show loading
    loading.style.display = 'block';
    tableWrapper.style.display = 'none';
    summaryCards.style.display = 'none';
    errorMsg.style.display = 'none';
    emptyState.style.display = 'none';
    fetchBtn.disabled = true;

    try {
      const resp = await fetch(`/api/report?startDate=${startDate}&endDate=${endDate}`);
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.details || data.error || 'Unknown error');
      }

      allRows = data.rows;
      filteredRows = [...allRows];

      // Update summary
      document.getElementById('totalRevenue').textContent = formatCurrency(data.totals.totalRevenue);
      document.getElementById('totalTransactions').textContent = data.totals.totalTransactions.toLocaleString();
      document.getElementById('totalItems').textContent = data.totals.totalItems.toLocaleString();

      const avg = data.totals.totalTransactions > 0
        ? data.totals.totalRevenue / data.totals.totalTransactions
        : 0;
      document.getElementById('avgTransaction').textContent = formatCurrency(avg);

      if (allRows.length === 0) {
        emptyState.style.display = 'block';
      } else {
        summaryCards.style.display = 'grid';
        tableWrapper.style.display = 'block';
        applySort();
        renderTable();
      }
    } catch (err) {
      showError(err.message);
    } finally {
      loading.style.display = 'none';
      fetchBtn.disabled = false;
    }
  }

  function showError(msg) {
    errorMsg.textContent = msg;
    errorMsg.style.display = 'block';
  }

  // Search / Filter
  searchInput.addEventListener('input', () => {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
      filteredRows = [...allRows];
    } else {
      filteredRows = allRows.filter((row) =>
        Object.values(row).some((val) =>
          String(val).toLowerCase().includes(query)
        )
      );
    }
    applySort();
    renderTable();
  });

  // Sort
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'asc';
      }

      // Update sort indicators
      document.querySelectorAll('th.sortable').forEach((h) => {
        h.classList.remove('asc', 'desc');
      });
      th.classList.add(sortDir);

      applySort();
      renderTable();
    });
  });

  function applySort() {
    filteredRows.sort((a, b) => {
      let valA = a[sortCol];
      let valB = b[sortCol];

      // Numeric sort for revenue and quantity
      if (sortCol === 'revenue' || sortCol === 'quantity') {
        valA = Number(valA);
        valB = Number(valB);
      } else {
        valA = String(valA).toLowerCase();
        valB = String(valB).toLowerCase();
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  function renderTable() {
    tableBody.innerHTML = '';

    filteredRows.forEach((row) => {
      const tr = document.createElement('tr');

      const utmEmpty = (val) => (!val || val === '(not set)' || val === '(none)');

      tr.innerHTML = `
        <td>${escapeHtml(row.date)}</td>
        <td>${escapeHtml(row.transactionId)}</td>
        <td class="${utmEmpty(row.firstSource) ? 'empty-utm' : ''}">${utmEmpty(row.firstSource) ? '-' : escapeHtml(row.firstSource)}</td>
        <td class="${utmEmpty(row.firstMedium) ? 'empty-utm' : ''}">${utmEmpty(row.firstMedium) ? '-' : escapeHtml(row.firstMedium)}</td>
        <td class="${utmEmpty(row.firstCampaign) ? 'empty-utm' : ''}">${utmEmpty(row.firstCampaign) ? '-' : escapeHtml(row.firstCampaign)}</td>
        <td class="${utmEmpty(row.source) ? 'empty-utm' : ''}">${utmEmpty(row.source) ? '-' : escapeHtml(row.source)}</td>
        <td class="${utmEmpty(row.medium) ? 'empty-utm' : ''}">${utmEmpty(row.medium) ? '-' : escapeHtml(row.medium)}</td>
        <td class="${utmEmpty(row.campaign) ? 'empty-utm' : ''}">${utmEmpty(row.campaign) ? '-' : escapeHtml(row.campaign)}</td>
        <td>${escapeHtml(row.itemName)}</td>
        <td class="revenue">${formatCurrency(row.revenue)}</td>
      `;
      tableBody.appendChild(tr);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Export CSV
  exportBtn.addEventListener('click', () => {
    if (filteredRows.length === 0) return;

    const headers = ['תאריך', 'מזהה עסקה', 'מקור ראשון', 'ערוץ ראשון', 'קמפיין ראשון', 'מקור סשן', 'ערוץ סשן', 'קמפיין (UTM)', 'שם מוצר', 'הכנסה'];
    const keys = ['date', 'transactionId', 'firstSource', 'firstMedium', 'firstCampaign', 'source', 'medium', 'campaign', 'itemName', 'revenue'];

    const csvRows = [
      // BOM for Hebrew support in Excel
      headers.join(','),
      ...filteredRows.map((row) =>
        keys.map((k) => {
          let val = row[k];
          // Wrap in quotes if contains comma or quotes
          val = String(val).replace(/"/g, '""');
          return `"${val}"`;
        }).join(',')
      ),
    ];

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `purchases_${startDateInput.value}_to_${endDateInput.value}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });
});
