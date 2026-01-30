# Backend Docker Deployment Guide

## Quick Start

### Build the Docker Image
```bash
cd c:\Users\User\Desktop\f1\backend
docker build -t f1-backend .
```

### Run with Docker Compose (Recommended)
```bash
cd c:\Users\User\Desktop\f1
docker-compose up -d
```

## Running Seeding Scripts

### Option 1: Using Docker Exec (Container Running)
```bash
# Seed a specific year
docker-compose exec backend python seed_year_data.py 2025

# Or if using plain Docker
docker exec -it <container-name> python seed_year_data.py 2025
```

### Option 2: Using Entrypoint Commands (One-Off)
```bash
# Seed using the entrypoint shortcut
docker-compose run --rm backend seed 2025

# Run historical seeding
docker-compose run --rm backend seed-history

# Run qualifying seeding
docker-compose run --rm backend seed-qualifying
```

### Option 3: Direct Python Script Execution
```bash
# Run any Python script
docker-compose exec backend python seed_history.py
docker-compose exec backend python verify_fix_all_races.py
```

## Environment Variables

Create a `.env` file in the backend directory with:

```env
# Database (AWS RDS PostgreSQL)
DATABASE_URL=postgresql://username:password@your-rds-endpoint:5432/dbname

# Flask Configuration
FLASK_DEBUG=false
CORS_ORIGINS=https://yourdomain.com

# Optional: Add other environment variables
```

## Deployment Workflow

1. **Build the image:**
   ```bash
   docker build -t f1-backend ./backend
   ```

2. **Push to registry (if using Docker Hub, ECR, etc.):**
   ```bash
   docker tag f1-backend:latest your-registry/f1-backend:latest
   docker push your-registry/f1-backend:latest
   ```

3. **Deploy to your server:**
   ```bash
   # Pull and run on production server
   docker pull your-registry/f1-backend:latest
   docker run -d -p 5000:5000 --env-file .env your-registry/f1-backend:latest
   ```

4. **Seed data after deployment:**
   ```bash
   docker exec -it <container-id> python seed_year_data.py 2025
   ```

## Available Entrypoint Commands

| Command | Description | Example |
|---------|-------------|---------|
| (default) | Run Flask app with gunicorn | `docker run f1-backend` |
| `seed <year>` | Run seed_year_data.py | `docker run f1-backend seed 2025` |
| `seed-history` | Run seed_history.py | `docker run f1-backend seed-history` |
| `seed-qualifying` | Run seed_qualifying.py | `docker run f1-backend seed-qualifying` |
| `python <script>` | Run any Python script | `docker run f1-backend python train_model.py` |

## Troubleshooting

### Database Connection Issues
- Ensure `DATABASE_URL` is correctly set in `.env`
- Verify AWS RDS security group allows connections from your Docker host
- Check that the database exists and credentials are correct

### Seeding Takes Too Long
- Seeding scripts fetch data from FastF1 API, which can be slow
- Consider running seeding scripts before deployment or during off-peak hours
- Use `docker logs -f <container-id>` to monitor progress

### Permission Errors
- Ensure `entrypoint.sh` is executable (should be handled by Dockerfile)
- If issues persist, manually set: `chmod +x entrypoint.sh`
