# Verdict QA - Production Checklist

## Pre-Deployment

- [ ] All tests passing
- [ ] TypeScript strict mode passes
- [ ] No linting errors
- [ ] Code reviewed by team
- [ ] Database migrations tested
- [ ] Environment variables set
- [ ] Security audit passed
- [ ] Performance benchmarks acceptable

## Frontend Deployment

- [ ] Build succeeds locally
- [ ] Build succeeds in CI
- [ ] Static assets optimized
- [ ] Images compressed
- [ ] No console errors in production
- [ ] Lighthouse score > 90

## Backend Deployment

- [ ] API endpoints tested
- [ ] Database queries optimized
- [ ] Error handling implemented
- [ ] Logging configured
- [ ] Health checks working
- [ ] Rate limiting configured

## Database Deployment

- [ ] Migrations tested in staging
- [ ] Backup created before migration
- [ ] Rollback plan documented
- [ ] Indexes created where needed
- [ ] Query performance validated

## Post-Deployment

- [ ] Monitor error logs
- [ ] Check API response times
- [ ] Verify database performance
- [ ] User acceptance testing
- [ ] Update documentation
- [ ] Notify team of deployment

## Rollback Plan

1. Revert to previous commit
2. Run database rollback migration
3. Clear cache/CDN
4. Verify system health
5. Post-mortem analysis

## Monitoring

- Sentry for error tracking
- DataDog for performance monitoring
- Database query logs
- API response time tracking
- Uptime monitoring

## Documentation Updates

- [ ] API documentation updated
- [ ] README reflects changes
- [ ] CHANGELOG updated
- [ ] Migration guide written
- [ ] Team notified
