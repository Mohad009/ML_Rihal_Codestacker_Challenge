-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS crimes_data (
    id SERIAL PRIMARY KEY,
    category TEXT,
    date TIMESTAMP,
    geometry GEOMETRY
); 