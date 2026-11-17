class FormSender {
    constructor({ form, endpoint, statusEl, cancelBtn = null, timeout = 15000 }) {
        if (!form || !endpoint || !statusEl) {
            throw new Error('FormSender: обязательные параметры — form, endpoint, statusEl');
        }

        this.form = form;
        this.endpoint = endpoint;
        this.statusEl = statusEl;
        this.cancelBtn = cancelBtn;
        this.timeout = timeout;

        this.controller = null;
        this.timerId = null;
        this.isSending = false;
        this.cancelReason = null;

        this._bindEvents();
    }

    _bindEvents() {
        this.form.addEventListener('submit', (e) => this._onSubmit(e));

        if (this.cancelBtn) {
            this.cancelBtn.addEventListener('click', () => this.cancel());
        }
    }

    async _onSubmit(event) {
        event.preventDefault();

        if (this.isSending) return;

        if (!this.form.checkValidity()) {
            this.form.reportValidity();
            this._setStatus('error', 'Пожалуйста, заполните все обязательные поля корректно.');
            return;
        }

        const formData = new FormData(this.form);

        this._startSending();

        try {
            const response = await this._send(formData);
            const data = await this._parseResponse(response);

            if (!response.ok) {
                throw new Error(data?.message || `Ошибка сервера: ${response.status}`);
            }

            this._setStatus('success', 'Анкета успешно отправлена! Мы свяжемся с вами.');
            this.form.reset();
        } catch (err) {
            if (err.name === 'AbortError') {
                if (this.cancelReason === 'timeout') {
                    this._setStatus('error', 'Превышено время ожидания. Сервер не отвечает.');
                } else {
                    this._setStatus('error', 'Вы отменили отправку анкеты.');
                }
            } else {
                this._setStatus('error', `Не удалось отправить: ${err.message}`);
            }
            console.error('[FormSender]', err);
        } finally {
            this._stopSending();
        }
    }

    async _send(formData) {
        this.controller = new AbortController();
        this.cancelReason = null;

        this.timerId = setTimeout(() => {
            this.cancelReason = 'timeout';
            this.cancel();
        }, this.timeout);
        await new Promise(resolve => setTimeout(resolve, 5000));

        return fetch(this.endpoint, {
            method: 'POST',
            body: formData,
            headers: {
                'Accept': 'application/json'
            },
            signal: this.controller.signal
        });
    }

    async _parseResponse(response) {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return null;
        try {
            return await response.json();
        } catch {
            return null;
        }
    }

    cancel() {
        if (this.controller) {
            if (!this.cancelReason) {
                this.cancelReason = 'user';
            }
            this.controller.abort();
            this.controller = null;
        }
    }

    _startSending() {
        this.isSending = true;
        this._setStatus('loading', 'Отправляем анкету…');
        if (this.cancelBtn) this.cancelBtn.hidden = false;
        const submitBtn = this.form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
    }

    _stopSending() {
        this.isSending = false;
        clearTimeout(this.timerId);
        this.timerId = null;
        this.controller = null;
        if (this.cancelBtn) this.cancelBtn.hidden = true;
        const submitBtn = this.form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = false;
    }

    _setStatus(type, message) {
        this.statusEl.textContent = message;
        this.statusEl.className = `form__status form__status--${type}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('client-form');
    if (!form) return;

    new FormSender({
        form,
        endpoint: 'https://formcarry.com/s/dWWOXCGqIbB',
        statusEl: document.getElementById('form-status'),
        cancelBtn: document.getElementById('cancel-btn'),
        timeout: 70000
    });
});