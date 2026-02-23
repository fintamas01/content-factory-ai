import { Check } from 'lucide-react';

const plans = [
  {
    name: 'Hobby',
    price: '0',
    features: ['Alap AI szöveggenerálás', 'Napi 5 kredit', 'Közösségi támogatás'],
    buttonText: 'Kezdés ingyen',
    pro: false,
  },
  {
    name: 'Pro',
    price: '19',
    features: ['Smart Content Matrix', 'Heti kampánytervező', 'Multi-platform (X, LinkedIn, IG)', 'Korlátlan mentés'],
    buttonText: 'Upgrade Most',
    pro: true,
  }
];

export default function Pricing() {
  return (
    <section className="py-20 bg-slate-950">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">Válassz csomagot</h2>
          <p className="text-slate-400">Turbózd fel a tartalomgyártásod mesterséges intelligenciával.</p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8">
          {plans.map((plan) => (
            <div key={plan.name} className={`p-8 rounded-3xl border ${plan.pro ? 'border-blue-500 bg-blue-500/5 shadow-[0_0_30px_rgba(59,130,246,0.2)]' : 'border-slate-800 bg-slate-900/50'} flex flex-col`}>
              <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-white">${plan.price}</span>
                <span className="text-slate-500">/hó</span>
              </div>
              <ul className="space-y-4 mb-8 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-3 text-slate-300">
                    <Check className="w-5 h-5 text-blue-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <button className={`w-full py-4 rounded-xl font-bold transition-all ${plan.pro ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}>
                {plan.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}