const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const app = express();
const multer = require('multer');
const mysql = require("mysql2");

const pool = mysql.createPool({
  host: "biozagora.ddns.net",
  user: "oth",
  password: "AbBa@2002####",
  database: "biozagora",
  port: 3306
});
const port = 5000;
const cors = require('cors');
app.use(cors({
    origin: 'https://facturationsystem.biozagora.com', // Allow requests from this origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
    credentials: true // Allow cookies and credentials
  }));

  const session = require('express-session');

  // Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`Server is running on http://0.0.0.0:${port}`);
  });

  
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


app.use(express.static(path.join(__dirname, 'src')));


app.get('/', (req, res) => {
  res.send('Server is running!');
});


// Routes
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const query = 'SELECT id, password FROM users WHERE email = ?';
  pool.query(query, [email], (err, results) => {
      if (err) {
          console.error('Error:', err);
          return res.status(500).json({ error: 'Failed to login.' });
      }
      if (results.length === 0) {
          return res.status(404).json({ error: 'User not found.' });
      }
      const user = results[0];
      bcrypt.compare(password, user.password, (err, isMatch) => {
          if (err || !isMatch) {
              return res.status(400).json({ error: 'Invalid password.' });
          }
          req.session.userId = user.id; // Store the correct user ID in the session
          console.log('User logged in with ID:', user.id); // Log the user ID
          res.status(200).json({ message: 'Login successful!' });
      });
  });
});

app.post('/api/register', (req, res) => {
  const { firstName, lastName, email, password } = req.body;
  bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
          console.error('Error:', err);
          return res.status(500).json({ error: 'Failed to register.' });
      }
      const query = 'INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)';
      pool.query(query, [firstName, lastName, email, hashedPassword], (err, result) => {
          if (err) {
              console.error('Error:', err);
              return res.status(500).json({ error: 'Failed to register.' });
          }
          res.status(200).json({ message: 'Registration successful!' });
      });
  });
});



// Updated route with filtering functionality
app.get('/api/invoices', (req, res) => {
  const { search, date } = req.query;
  
  let query = 'SELECT * FROM invoice_data';
  const params = [];
  
  // Build WHERE clauses based on provided filters
  if (search || date) {
    query += ' WHERE';
    
    // Add search filter
    if (search) {
      query += ' (facture_number LIKE ? OR client_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
      
      // If both search and date are provided, add AND
      if (date) {
        query += ' AND';
      }
    }
    
    // Add date filter
    if (date) {
      query += ' DATE(facture_date) = ?';
      params.push(date);
    }
  }
  
  // Add ordering
  query += ' ORDER BY facture_date DESC';
  
  console.log('Query:', query);
  console.log('Params:', params);
  
  pool.query(query, params, (err, results) => {
    if (err) {
      console.error('Error fetching invoices:', err);
      res.status(500).json({ error: 'Failed to fetch invoices' });
      return;
    }
    res.json(results);
  });
});

// Fetch 5 invoices
app.get('/api/invoices-5', (req, res) => {
  const query = 'SELECT * FROM invoice_data ORDER BY facture_date DESC LIMIT 5;';
  pool.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching invoices:', err);
          res.status(500).json({ error: 'Failed to fetch invoices' });
          return;
      }
      res.json(results);
  });
});


app.delete('/api/invoices/:invoice_number', async (req, res) => {
  const invoiceNumber = req.params.invoice_number;
  console.log('Attempting to delete invoice:', invoiceNumber);

  // Validate invoice number
  if (!invoiceNumber || typeof invoiceNumber !== 'string') {
      return res.status(400).json({
          success: false,
          message: 'Invalid invoice number'
      });
  }

  const query1 = 'DELETE FROM invoice_data WHERE facture_number = ?';
  const query2 = 'DELETE FROM invoice_products WHERE facture_number = ?';

  // Ensure pool is defined
  if (!pool) {
      console.error('Database pool is not initialized');
      return res.status(500).json({ 
          success: false, 
          message: 'Database connection error'
      });
  }

  try {
      // Execute the first query
      const [result1] = await pool.promise().query(query1, [invoiceNumber]);
      if (result1.affectedRows === 0) {
          console.log('Invoice not found in invoice_data:', invoiceNumber);
          return res.status(404).json({
              success: false,
              message: `Invoice ${invoiceNumber} not found`
          });
      }

      // Execute the second query
      const [result2] = await pool.promise().query(query2, [invoiceNumber]);
      if (result2.affectedRows === 0) {
          console.log('Invoice not found in invoice_products:', invoiceNumber);
          return res.status(404).json({
              success: false,
              message: `Invoice ${invoiceNumber} not found`
          });
      }

      console.log('Invoice deleted successfully:', invoiceNumber);
      return res.json({ 
          success: true, 
          message: `Invoice ${invoiceNumber} has been deleted`,
          affectedRows: result1.affectedRows + result2.affectedRows
      });
  } catch (err) {
      console.error('Error during invoice deletion:', err);
      return res.status(500).json({ 
          success: false, 
          message: 'Failed to delete invoice', 
          error: err.message 
      });
  }
});


app.delete('/api/quotations/:devis_number', async (req, res) => {
  const devisNumber = req.params.devis_number;
  console.log('Attempting to delete devis:', devisNumber);

  // Validate invoice number
  if (!devisNumber || typeof devisNumber !== 'string') {
      return res.status(400).json({
          success: false,
          message: 'Invalid devis number'
      });
  }

  const query1 = 'DELETE FROM devis_data WHERE devis_number = ?';
  const query2 = 'DELETE FROM devis_products WHERE devis_number = ?';

  // Ensure pool is defined
  if (!pool) {
      console.error('Database pool is not initialized');
      return res.status(500).json({ 
          success: false, 
          message: 'Database connection error'
      });
  }

  try {
      // Execute the first query
      const [result1] = await pool.promise().query(query1, [devisNumber]);
      if (result1.affectedRows === 0) {
          console.log('devis not found in devis_data:', devisNumber);
          return res.status(404).json({
              success: false,
              message: `devis ${devisNumber} not found`
          });
      }

      // Execute the second query
      const [result2] = await pool.promise().query(query2, [devisNumber]);
      if (result2.affectedRows === 0) {
          console.log('devis not found in devis_products:', devisNumber);
          return res.status(404).json({
              success: false,
              message: `devis ${devisNumber} not found`
          });
      }

      console.log('devis deleted successfully:', devisNumber);
      return res.json({ 
          success: true, 
          message: `devis ${devisNumber} has been deleted`,
          affectedRows: result1.affectedRows + result2.affectedRows
      });
  } catch (err) {
      console.error('Error during devis deletion:', err);
      return res.status(500).json({ 
          success: false, 
          message: 'Failed to delete devis', 
          error: err.message 
      });
  }
});





// Updated route with filtering functionality for quotations
app.get('/api/quotations', (req, res) => {
  const { search, date } = req.query;
  
  let query = 'SELECT * FROM devis_data';
  const params = [];
  
  // Build WHERE clauses based on provided filters
  if (search || date) {
    query += ' WHERE';
    
    // Add search filter
    if (search) {
      query += ' (devis_number LIKE ? OR client_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
      
      // If both search and date are provided, add AND
      if (date) {
        query += ' AND';
      }
    }
    
    // Add date filter
    if (date) {
      query += ' DATE(devis_date) = ?';
      params.push(date);
    }
  }
  
  // Add ordering
  query += ' ORDER BY devis_date DESC';
  
  pool.query(query, params, (err, results) => {
    if (err) {
      console.error('Error fetching quotations:', err);
      res.status(500).json({ error: 'Failed to fetch quotations' });
      return;
    }
    res.json(results);
  });
});


// Fetch all devis
app.get('/api/quotations-5', (req, res) => {
  const query = 'SELECT * FROM devis_data ORDER BY devis_date DESC LIMIT 5;';
  pool.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching devis:', err);
          res.status(500).json({ error: 'Failed to fetch invoices' });
          return;
      }
      res.json(results);
  });
});






  app.get('/get-user-info', (req, res) => {
    const userId = req.session.userId; // Retrieve the user ID from the session
    console.log('Fetching info for user ID:', userId); // Log the user ID
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }
    const query = 'SELECT first_name, last_name, email FROM users WHERE id = ?';
    pool.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user info:', err);
            return res.status(500).json({ error: 'Failed to fetch user info.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        console.log('User info fetched:', results[0]); // Log the fetched data
        res.status(200).json(results[0]); // Send the user's information as JSON
    });
  });


  app.post('/update-user-info', (req, res) => {
    const userId = req.session.userId; // Get the user ID from the session
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }
  
    const { firstName, lastName, email, password } = req.body;
  
    // If a new password is provided, hash it
    if (password) {
        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) {
                console.error('Error hashing password:', err);
                return res.status(500).json({ error: 'Failed to update user info.' });
            }
  
            // Update user info with the new hashed password
            const query = `
                UPDATE users 
                SET first_name = ?, last_name = ?, email = ?, password = ? 
                WHERE id = ?
            `;
            pool.query(query, [firstName, lastName, email, hashedPassword, userId], (err, result) => {
                if (err) {
                    console.error('Error updating user info:', err);
                    return res.status(500).json({ error: 'Failed to update user info.' });
                }
                res.status(200).json({ message: 'User info updated successfully!' });
            });
        });
    } else {
        // Update user info without changing the password
        const query = `
            UPDATE users 
            SET first_name = ?, last_name = ?, email = ? 
            WHERE id = ?
        `;
        pool.query(query, [firstName, lastName, email, userId], (err, result) => {
            if (err) {
                console.error('Error updating user info:', err);
                return res.status(500).json({ error: 'Failed to update user info.' });
            }
            res.status(200).json({ message: 'User info updated successfully!' });
        });
    }
  });
  

  app.get('/get-user-name', (req, res) => {
    const userId = req.session.userId; // Get the user ID from the session
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }
  
    const query = 'SELECT first_name FROM users WHERE id = ?';
    pool.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user name:', err);
            return res.status(500).json({ error: 'Failed to fetch user name.' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.status(200).json({ firstName: results[0].first_name }); 
    });
  });
  
  app.get('/get-email', (req, res) => {
    const userId = req.session.userId; 
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }
  
    const query = 'SELECT email FROM users WHERE id = ?';
    pool.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching email:', err);
            return res.status(500).json({ error: 'Failed to fetch email' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
        res.status(200).json({ email: results[0].email }); 
    });
  });

  app.post('/delete-account', (req, res) => {
    const userId = req.session.userId; // Get the user ID from the session
    if (!userId) {
        return res.status(401).json({ error: 'User not authenticated.' });
    }
  
    const query = 'DELETE FROM users WHERE id = ?';
    pool.query(query, [userId], (err, result) => {
        if (err) {
            console.error('Error deleting account:', err);
            return res.status(500).json({ error: 'Failed to delete account.' });
        }
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'User not found.' });
        }
  
        // Destroy the session after deleting the account
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
                return res.status(500).json({ error: 'Failed to destroy session.' });
            }
            res.status(200).json({ message: 'Account deleted successfully!' });
        });
    });
  });



  app.get('/api/clients', (req, res) => {
    const { search } = req.query;
  
    let query = 'SELECT * FROM clients';
    const params = [];
  
    // Build WHERE clause if search parameter is provided
    if (search) {
      query += ' WHERE client LIKE ? OR ice LIKE ?';
      params.push(`%${search}%`, `%${search}%`);
    }
  
    // Add ordering
    query += ' ORDER BY id DESC';
  
    // Execute the query
    pool.query(query, params, (err, results) => {
      if (err) {
        console.error('Error fetching clients:', err);
        res.status(500).json({ error: 'Failed to fetch clients' });
        return;
      }
      res.json(results);
    });
  });

// DELETE route to delete a quotation by quotation number
app.delete('/api/clients/:ICE', (req, res) => {
  const clientICE = req.params.ICE;
  
  // MySQL query to delete the quotation
  const query = 'DELETE FROM clients WHERE ICE = ?';
  
  pool.query(query, [clientICE], (err, results) => {
    if (err) {
      console.error('Error deleting client:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to delete client',
        error: err.message
      });
    }
    
    if (results.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: `Client ${clientICE} not found`
      });
    }
    
    // Successfully deleted
    return res.json({ 
      success: true, 
      message: `Clinet ${clientICE} has been deleted`,
      affectedRows: results.affectedRows
    });
  });
});



// Check if a client exists
app.post('/api/check-client', (req, res) => {
  const { ICE } = req.body;
  const query = 'SELECT id FROM clients WHERE ICE = ?';

  pool.query(query, [ICE], (err, results) => {
      if (err) {
          console.error('Error checking client:', err);
          return res.status(500).json({ error: 'Failed to check client existence' });
      }

      res.json({ exists: results.length > 0 });
  });
});

// Add a new client
app.post('/api/add-client', (req, res) => {
  const { ICE, Client } = req.body;
  const query = 'INSERT INTO clients (ICE, Client) VALUES (?, ?)';

  pool.query(query, [ICE, Client], (err, results) => {
      if (err) {
          console.error('Error adding client:', err);
          return res.status(500).json({ error: 'Failed to add client' });
      }

      res.json({ success: true, message: 'Client added successfully' });
  });
});

// Endpoint to get total number of invoices
app.get('/api/total-invoices', (req, res) => {
  pool.query('SELECT COUNT(*) AS totalInvoices FROM invoice_data', (error, results) => {
      if (error) {
          console.error('Error fetching total invoices:', error);
          return res.status(500).json({ error: 'Failed to fetch total invoices' });
      }
      const totalInvoices = results[0].totalInvoices;
      res.json(totalInvoices);
  });
});

// Endpoint to get total number of devis
app.get('/api/total-devis', (req, res) => {
  pool.query('SELECT COUNT(*) AS totalDevis FROM devis_data', (error, results) => {
      if (error) {
          console.error('Error fetching total devis:', error);
          return res.status(500).json({ error: 'Failed to fetch total devis' });
      }
      const totalDevis = results[0].totalDevis;
      res.json(totalDevis);
  });
});

// Endpoint to get total number of clients
app.get('/api/total-clients', (req, res) => {
  pool.query('SELECT COUNT(*) AS totalClients FROM clients', (error, results) => {
      if (error) {
          console.error('Error fetching total clients:', error);
          return res.status(500).json({ error: 'Failed to fetch total clients' });
      }
      const totalClients = results[0].totalClients;
      res.json(totalClients);
  });
});



app.get('/api/get-client', (req, res) => {
  const { client } = req.query; 

  if (!client) {
      return res.status(400).json({ error: "Client name is required" });
  }

  const sql = "SELECT ICE FROM clients WHERE client = ?";
  pool.query(sql, [client], (err, result) => {
      if (err) {
          return res.status(500).json({ error: "Database error: " + err.message });
      }
      
      if (result.length > 0) {
          res.json({ ice: result[0].ICE }); 
      } else {
          res.json({ ice: null }); 
      }
  });
});



app.post('/api/save-invoice-data', (req, res) => {
  const { factureNum, factureDate, clientName, clientICE, products, paymentMethod } = req.body;

  const checkQuery = 'SELECT * FROM invoice_data WHERE facture_number = ?';
  pool.query(checkQuery, [factureNum], (err, result) => {
    if (err) {
      console.error('Error checking invoice:', err);
      return res.status(500).json({ message: 'Failed to check invoice.' });
    }

    if (result.length > 0) {
      // UPDATE EXISTING INVOICE
      const updateQuery = 'UPDATE invoice_data SET facture_date=?, client_name=?, client_ice=?, payment_method=? WHERE facture_number=?';
      pool.query(updateQuery, [factureDate, clientName, clientICE, paymentMethod, factureNum], (err) => {
        if (err) {
          console.error('Error updating invoice data:', err);
          return res.status(500).json({ message: 'Failed to update invoice data.' });
        }

        // DELETE old products first
        pool.query('DELETE FROM invoice_products WHERE facture_number=?', [factureNum], (err) => {
          if (err) {
            console.error('Error deleting old products:', err);
            return res.status(500).json({ message: 'Failed to delete old products.' });
          }

          // INSERT new products
          const productQuery = 'INSERT INTO invoice_products (facture_number, designation, quantite, prix, tva) VALUES ?';
          const productValues = products.map(p => [factureNum, p.designation, p.quantite, p.prix, p.tva]);
          pool.query(productQuery, [productValues], (err) => {
            if (err) {
              console.error('Error saving updated products:', err);
              return res.status(500).json({ message: 'Failed to save updated products.' });
            }

            return res.status(200).json({ message: 'Invoice updated successfully.' });
          });
        });
      });

    } else {
      // INSERT NEW INVOICE
      const insertQuery = 'INSERT INTO invoice_data (facture_number, facture_date, client_name, client_ice, payment_method) VALUES (?, ?, ?, ?, ?)';
      pool.query(insertQuery, [factureNum, factureDate, clientName, clientICE, paymentMethod], (err) => {
        if (err) {
          console.error('Error saving new invoice data:', err);
          return res.status(500).json({ message: 'Failed to save invoice data.' });
        }

        const productQuery = 'INSERT INTO invoice_products (facture_number, designation, quantite, prix, tva) VALUES ?';
        const productValues = products.map(p => [factureNum, p.designation, p.quantite, p.prix, p.tva]);
        pool.query(productQuery, [productValues], (err) => {
          if (err) {
            console.error('Error saving products:', err);
            return res.status(500).json({ message: 'Failed to save products.' });
          }

          return res.status(200).json({ message: 'Invoice and products saved successfully.' });
        });
      });
    }
  });
});


app.get('/api/getInvoiceData/:factureNum', (req, res) => {
  const factureNum = req.params.factureNum;

  // Query to get the invoice data from the database
  const query = `
      SELECT 
          i.facture_number,
          i.facture_date,
          i.client_name,
          i.client_ice,
          i.payment_method,
          p.designation,
          p.quantite,
          p.prix,
          p.tva,
          (p.quantite * p.prix) AS totalTTC
      FROM invoice_data AS i
      JOIN invoice_products AS p ON i.facture_number = p.facture_number
      WHERE i.facture_number = ?
  `;

  pool.query(query, [factureNum], (error, results) => {
      if (error) {
          console.error('Error fetching invoice data:', error);
          return res.status(500).json({ message: 'Error fetching invoice data' });
      }

      // If no data found
      if (results.length === 0) {
          return res.status(404).json({ message: 'Invoice not found' });
      }

      // Format the results into a structured format
      const invoiceData = {
          factureNum: results[0].facture_number, 
          factureDate: results[0].facture_date, 
          clientName: results[0].client_name,   
          clientICE: results[0].client_ice,     
          paymentMethod: results[0].payment_method, 
          products: results.map(row => ({
              designation: row.designation,
              quantite: row.quantite,
              prix: row.prix,
              tva: row.tva,
          }))
      };

      // Send the invoice data as response
      res.json(invoiceData);
  });
});


app.post('/api/save-devis-data', (req, res) => {
  const { factureNum, factureDate, clientName, clientICE, products, paymentMethod } = req.body;

  const checkQuery = 'SELECT * FROM devis_data WHERE devis_number = ?';
  pool.query(checkQuery, [factureNum], (err, result) => {
    if (err) {
      console.error('Error checking devis:', err);
      return res.status(500).json({ message: 'Failed to check invoice.' });
    }

    if (result.length > 0) {
      // UPDATE EXISTING INVOICE
      const updateQuery = 'UPDATE devis_data SET devis_date=?, client_name=?, client_ice=?, payment_method=? WHERE devis_number=?';
      pool.query(updateQuery, [factureDate, clientName, clientICE, paymentMethod, factureNum], (err) => {
        if (err) {
          console.error('Error updating invoice data:', err);
          return res.status(500).json({ message: 'Failed to update invoice data.' });
        }

        // DELETE old products first
        pool.query('DELETE FROM devis_products WHERE devis_number=?', [factureNum], (err) => {
          if (err) {
            console.error('Error deleting old products:', err);
            return res.status(500).json({ message: 'Failed to delete old products.' });
          }

          // INSERT new products
          const productQuery = 'INSERT INTO devis_products (devis_number, designation, quantite, prix, tva) VALUES ?';
          const productValues = products.map(p => [factureNum, p.designation, p.quantite, p.prix, p.tva]);
          pool.query(productQuery, [productValues], (err) => {
            if (err) {
              console.error('Error saving updated products:', err);
              return res.status(500).json({ message: 'Failed to save updated products.' });
            }

            return res.status(200).json({ message: 'devis updated successfully.' });
          });
        });
      });

    } else {
      // INSERT NEW INVOICE
      const insertQuery = 'INSERT INTO devis_data (devis_number, devis_date, client_name, client_ice, payment_method) VALUES (?, ?, ?, ?, ?)';
      pool.query(insertQuery, [factureNum, factureDate, clientName, clientICE, paymentMethod], (err) => {
        if (err) {
          console.error('Error saving new devis data:', err);
          return res.status(500).json({ message: 'Failed to save devis data.' });
        }

        const productQuery = 'INSERT INTO devis_products (devis_number, designation, quantite, prix, tva) VALUES ?';
        const productValues = products.map(p => [factureNum, p.designation, p.quantite, p.prix, p.tva]);
        pool.query(productQuery, [productValues], (err) => {
          if (err) {
            console.error('Error saving products:', err);
            return res.status(500).json({ message: 'Failed to save products.' });
          }

          return res.status(200).json({ message: 'Invoice and products saved successfully.' });
        });
      });
    }
  });
});


app.get('/api/getDevisData/:factureNum', (req, res) => {
  const factureNum = req.params.factureNum;

  // Query to get the invoice data from the database
  const query = `
      SELECT 
          i.devis_number,
          i.devis_date,
          i.client_name,
          i.client_ice,
          i.payment_method,
          p.designation,
          p.quantite,
          p.prix,
          p.tva,
          (p.quantite * p.prix) AS totalTTC
      FROM devis_data AS i
      JOIN devis_products AS p ON i.devis_number = p.devis_number
      WHERE i.devis_number = ?
  `;

  pool.query(query, [factureNum], (error, results) => {
      if (error) {
          console.error('Error fetching devis data:', error);
          return res.status(500).json({ message: 'Error fetching devis data' });
      }

      // If no data found
      if (results.length === 0) {
          return res.status(404).json({ message: 'devis not found' });
      }

      // Format the results into a structured format
      const invoiceData = {
          factureNum: results[0].devis_number, // Corrected field name
          factureDate: results[0].devis_date, // Corrected field name
          clientName: results[0].client_name,   // Corrected field name
          clientICE: results[0].client_ice,     // Corrected field name
          paymentMethod: results[0].payment_method, // Corrected field name
          products: results.map(row => ({
              designation: row.designation,
              quantite: row.quantite,
              prix: row.prix,
              tva: row.tva,
          }))
      };

      // Send the invoice data as response
      res.json(invoiceData);
  });
});
