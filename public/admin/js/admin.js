'use strict';

function confirmDelete(actionUrl, label, triggerEl) {
  if (!window.confirm('Radera "' + label + '"? Detta kan inte ångras.')) return;
  var form = document.getElementById('delete-form');
  if (!form) return;
  form.action = actionUrl;
  form.submit();
}

(function initFileUpload() {
  var dropZone  = document.getElementById('drop-zone');
  var fileInput = document.getElementById('file');
  var preview   = document.getElementById('file-preview');
  if (!dropZone || !fileInput) return;

  dropZone.addEventListener('click', function(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
    fileInput.click();
  });

  fileInput.addEventListener('change', function() {
    showPreview(fileInput.files[0]);
  });

  dropZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone.addEventListener('dragleave', function() {
    dropZone.classList.remove('drag-over');
  });

  dropZone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    var file = e.dataTransfer.files[0];
    if (!file) return;
    try {
      var dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
    } catch(ex) {}
    showPreview(file);
  });

  function showPreview(file) {
    if (!file || !preview) return;
    preview.style.display = 'block';
    if (file.type.startsWith('image/')) {
      var reader = new FileReader();
      reader.onload = function(e) {
        preview.innerHTML =
          '<img src="' + e.target.result + '" style="max-height:180px;border-radius:6px;border:1px solid #e2e2dc" alt="Preview" />' +
          '<p style="margin-top:.35rem;font-size:.8rem;color:#6b6b65">' + file.name + ' — ' + (file.size/1024).toFixed(0) + ' KB</p>';
      };
      reader.readAsDataURL(file);
    } else {
      preview.innerHTML =
        '<p style="font-size:.88rem">Vald fil: <strong>' + file.name + '</strong> — ' + (file.size/1024/1024).toFixed(1) + ' MB</p>';
    }
  }
})();

(function initUploadForm() {
  var form     = document.getElementById('upload-form');
  var progress = document.getElementById('upload-progress');
  var fill     = document.getElementById('progress-fill');
  var label    = document.getElementById('progress-label');
  var btn      = document.getElementById('upload-btn');
  if (!form || !btn) return;

  btn.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();

    var fileInput = document.getElementById('file');
    if (!fileInput || !fileInput.files[0]) {
      alert('Välj en fil först.');
      return;
    }

    var data = new FormData(form);
    var xhr  = new XMLHttpRequest();
    xhr.open('POST', form.action);

    if (xhr.upload && progress && fill && label) {
      progress.style.display = 'block';
      xhr.upload.addEventListener('progress', function(ev) {
        if (!ev.lengthComputable) return;
        var pct = Math.round(ev.loaded / ev.total * 100);
        fill.style.width  = pct + '%';
        label.textContent = 'Laddar upp... ' + pct + '%';
      });
    }

    xhr.addEventListener('load', function() {
      window.location.href = '/admin/media';
    });

    xhr.addEventListener('error', function() {
      alert('Uppladdningen misslyckades. Försök igen.');
      btn.disabled = false;
    });

    btn.disabled = true;
    xhr.send(data);
  });
})();

function openEditCategory(id, name, description, sortOrder) {
  var form   = document.getElementById('category-form');
  var title  = document.getElementById('category-form-title');
  var submit = document.getElementById('cat-submit');
  var cancel = document.getElementById('cat-cancel');
  if (!form) return;
  form.action = '/admin/categories/' + id;
  document.getElementById('cat-name').value  = name;
  document.getElementById('cat-desc').value  = description || '';
  document.getElementById('cat-order').value = sortOrder || 0;
  title.textContent    = 'Redigera kategori';
  submit.textContent   = 'Spara';
  cancel.style.display = 'inline-flex';
  form.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetCategoryForm() {
  var form   = document.getElementById('category-form');
  var title  = document.getElementById('category-form-title');
  var submit = document.getElementById('cat-submit');
  var cancel = document.getElementById('cat-cancel');
  if (!form) return;
  form.action        = '/admin/categories';
  form.reset();
  title.textContent    = 'Ny kategori';
  submit.textContent   = 'Skapa';
  cancel.style.display = 'none';
}

(function autoDismiss() {
  document.querySelectorAll('.alert-success').forEach(function(el) {
    setTimeout(function() {
      el.style.transition = 'opacity .5s';
      el.style.opacity    = '0';
      setTimeout(function() { el.remove(); }, 500);
    }, 4000);
  });
})();