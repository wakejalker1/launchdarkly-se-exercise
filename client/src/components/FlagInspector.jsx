import { useFlags } from 'launchdarkly-react-client-sdk';
import { FLAGS } from '../lib/flags.js';

// A live debugging panel: shows the current flag values and the active context.
// Handy during a demo to prove what the SDK is actually returning.
export default function FlagInspector({ persona }) {
  const flags = useFlags();
  const watched = [FLAGS.RELEASE_RECOMMENDATIONS, FLAGS.NEW_LANDING_HERO];

  return (
    <section className="panel panel-muted">
      <div className="panel-head">
        <h2>
          <span className="tag tag-debug">Live</span> Flag &amp; context inspector
        </h2>
      </div>

      <div className="inspector-grid">
        <div>
          <h4>Flag values (this context)</h4>
          <table className="kv">
            <tbody>
              {watched.map((key) => (
                <tr key={key}>
                  <td>
                    <code>{key}</code>
                  </td>
                  <td>
                    <code className="val">{JSON.stringify(flags[key])}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4>Active context</h4>
          <pre className="ctx">{JSON.stringify(persona.context, null, 2)}</pre>
        </div>
      </div>
    </section>
  );
}
