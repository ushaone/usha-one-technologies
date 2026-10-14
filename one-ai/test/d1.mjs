import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
// Real SQLite, exposed through the subset of the D1 prepared-statement API used by the worker.
export class D1 {
 constructor(product='usha-one') {
  this.sqlite=new DatabaseSync(':memory:'); this.sqlite.exec('PRAGMA foreign_keys=ON');
  for(const name of ['0001_initial.sql','0002_security.sql'])this.sqlite.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  this.sqlite.prepare('INSERT INTO one_ai_instance VALUES (1,?)').run(product);
 }
 prepare(sql) {
  const db=this.sqlite; let args=[];
  return {bind(...values){args=values;return this;},async first(){return db.prepare(sql).get(...args)??null;},
   async all(){return {results:db.prepare(sql).all(...args)};},async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:result.changes}};}};
 }
 principal(tenant,actor,role='staff') { this.sqlite.prepare('INSERT INTO one_ai_principals(tenant_id,actor_id,role) VALUES (?,?,?)').run(tenant,actor,role); }
 close(){this.sqlite.close();}
}
