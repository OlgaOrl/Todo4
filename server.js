const express = require('express');
const swaggerUi = require('swagger-ui-express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');

const app = express();
app.use(express.json());

// 1. Считываем и распарсиваем файл openapi.yaml
const swaggerDocument = yaml.load(
    fs.readFileSync(path.join(__dirname, 'openapi.yaml'), 'utf-8')
);

// 2. Подключаем Swagger UI на /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Инициализируем БД в памяти
const db = new sqlite3.Database(':memory:');

// Создаём таблицу
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      completed BOOLEAN NOT NULL DEFAULT 0
    )
  `);
});

// =========== Эндпоинты ===========

// GET /todos
app.get('/todos', (req, res) => {
    db.all('SELECT * FROM todos', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /todos
app.post('/todos', (req, res) => {
    const { title, description, completed } = req.body;
    if (!title) {
        return res.status(400).json({ error: 'Invalid input: title is required' });
    }
    db.run(
        `INSERT INTO todos (title, description, completed) VALUES (?, ?, ?)`,
        [title, description || '', completed ? 1 : 0],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            const insertedId = this.lastID;
            db.get('SELECT * FROM todos WHERE id = ?', [insertedId], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json(row);
            });
        }
    );
});

// GET /todos/:todoId
app.get('/todos/:todoId', (req, res) => {
    const { todoId } = req.params;
    db.get('SELECT * FROM todos WHERE id = ?', [todoId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Task not found' });
        res.json(row);
    });
});

// PUT /todos/:todoId
app.put('/todos/:todoId', (req, res) => {
    const { todoId } = req.params;
    const { title, description, completed } = req.body;
    if (!title) {
        return res.status(400).json({ error: 'Invalid input: title is required' });
    }
    db.run(
        `UPDATE todos
     SET title = ?, description = ?, completed = ?
     WHERE id = ?`,
        [title, description || '', completed ? 1 : 0, todoId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Task not found' });
            db.get('SELECT * FROM todos WHERE id = ?', [todoId], (err, row) => {
                if (err) return res.status(500).json({ error: err.message });
                res.json(row);
            });
        }
    );
});

// PATCH /todos/:todoId
app.patch('/todos/:todoId', (req, res) => {
    const { todoId } = req.params;
    const { title, description, completed } = req.body;

    db.get('SELECT * FROM todos WHERE id = ?', [todoId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'Task not found' });

        // Обновляем только переданные поля
        const updatedTitle = title !== undefined ? title : row.title;
        const updatedDescription = description !== undefined ? description : row.description;
        const updatedCompleted = completed !== undefined ? (completed ? 1 : 0) : row.completed;

        db.run(
            `UPDATE todos
       SET title = ?, description = ?, completed = ?
       WHERE id = ?`,
            [updatedTitle, updatedDescription, updatedCompleted, todoId],
            function (err) {
                if (err) return res.status(500).json({ error: err.message });
                db.get('SELECT * FROM todos WHERE id = ?', [todoId], (err, updatedRow) => {
                    if (err) return res.status(500).json({ error: err.message });
                    res.json(updatedRow);
                });
            }
        );
    });
});

// DELETE /todos/:todoId
app.delete('/todos/:todoId', (req, res) => {
    const { todoId } = req.params;
    db.run('DELETE FROM todos WHERE id = ?', [todoId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Task not found' });
        }
        res.status(204).send();
    });
});

// Запускаем сервер
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Swagger docs: http://localhost:${PORT}/docs`);
});
