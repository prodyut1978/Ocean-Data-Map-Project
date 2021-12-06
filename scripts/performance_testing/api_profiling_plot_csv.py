import defopt
import matplotlib.pyplot as plt
import pandas as pd

def main(fname : str, id : str):
    csv_data = pd.read_csv(fname, header=None, names = range(4))
    table_names = ["profile", "virtual_mooring", "transect", "hovmoller", 'area']
    groups = csv_data[0].isin(table_names).cumsum()
    tables = {g.iloc[0,0]: g.iloc[1:] for k,g in csv_data.groupby(groups)}

    for name, table in tables.items():
        table.columns = table.iloc[0]
        table = table.drop(table.index[0])
        datasets = table['Dataset'].unique()

        img = plt.figure()

        for d in datasets:        
            data = table.loc[table['Dataset'] == d]
            variables = data['Variable']
            plt.plot(pd.to_numeric(data['Response Time']).values, label=d)

        plt.ylabel('Time (s)')
        plt.xlabel('Variable')
        plt.title(name)
        plt.xticks(range(len(variables)),variables)
        plt.legend()
        plt.savefig(f'{id}_{name}_times.png')
        img.clear()

if __name__ == '__main__':
    defopt.run(main)
